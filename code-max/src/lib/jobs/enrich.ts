import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichLead, recordUsage } from "../radar";
import type { Lead, Service } from "../types";

/**
 * Processa até `max` jobs de enriquecimento pendentes.
 * Com o cliente do usuário a RLS limita aos jobs dele; com service role (cron) pega de todos.
 */
export async function processEnrichJobs(sb: SupabaseClient, opts: { max: number; searchId?: string; userId?: string }) {
  let q = sb.from("jobs").select("id, user_id, payload, tentativas").eq("tipo", "enrich_lead").eq("status", "pendente").lte("executar_em", new Date().toISOString()).order("criado_em").limit(opts.max);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.searchId) q = q.eq("payload->>search_id", opts.searchId);
  const { data: jobs } = await q;
  if (!jobs?.length) return { processed: 0 };

  // Reivindica (otimista): só fica com os jobs que ainda estavam pendentes.
  const { data: claimed } = await sb
    .from("jobs")
    .update({ status: "rodando", atualizado_em: new Date().toISOString() })
    .in("id", jobs.map((j) => j.id))
    .eq("status", "pendente")
    .select("id, user_id, payload, tentativas");
  if (!claimed?.length) return { processed: 0 };

  const ctxCache = new Map<string, { weights: Record<string, number> | null; services: Service[] }>();
  async function ctxFor(userId: string) {
    if (!ctxCache.has(userId)) {
      const [{ data: p }, { data: s }] = await Promise.all([
        sb.from("profiles").select("score_pesos").eq("user_id", userId).maybeSingle(),
        sb.from("services").select("*").eq("user_id", userId),
      ]);
      ctxCache.set(userId, { weights: (p?.score_pesos as Record<string, number>) ?? null, services: (s ?? []) as Service[] });
    }
    return ctxCache.get(userId)!;
  }

  await Promise.all(
    claimed.map(async (job) => {
      const leadId = (job.payload as { lead_id: string }).lead_id;
      try {
        const { data: lead } = await sb.from("leads").select("*").eq("id", leadId).maybeSingle();
        if (!lead) throw new Error("lead não encontrado");
        await sb.from("leads").update({ enriquecimento: "rodando" }).eq("id", leadId);
        const ctx = await ctxFor(job.user_id);
        const r = await enrichLead(sb, lead as Lead & { user_id: string }, { weights: ctx.weights, services: ctx.services });
        await recordUsage(sb, job.user_id, "pagespeed", r.pagespeedCalls);
        await sb.from("jobs").update({ status: "feito", atualizado_em: new Date().toISOString() }).eq("id", job.id);
      } catch (e) {
        const tentativas = (job.tentativas ?? 0) + 1;
        await sb
          .from("jobs")
          .update({
            status: tentativas >= 3 ? "erro" : "pendente",
            tentativas,
            erro: e instanceof Error ? e.message.slice(0, 500) : "erro",
            executar_em: new Date(Date.now() + tentativas * 60_000).toISOString(),
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", job.id);
        if (tentativas >= 3) await sb.from("leads").update({ enriquecimento: "erro" }).eq("id", leadId);
      }
    }),
  );
  return { processed: claimed.length };
}
