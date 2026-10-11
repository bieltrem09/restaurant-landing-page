import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeadDetail } from "../data";
import type { PlaybookEntry, PortfolioItem, Profile, Service } from "../types";
import { buildSystemPrompt, type Mode, type OrdeliryContextInput } from "./context";

/** Monta o contexto completo da Ordeliry no servidor (perfil, catálogo, lead, histórico, ganhos, playbook). */
export async function loadSystemPrompt(sb: SupabaseClient, userId: string, opts: { leadId?: string | null; mode?: Mode; simulador?: OrdeliryContextInput["simulador"]; now?: Date }) {
  const [{ data: profile }, { data: services }, { data: portfolio }, { data: playbook }] = await Promise.all([
    sb.from("profiles").select("*").eq("user_id", userId).single(),
    sb.from("services").select("*").order("criado_em"),
    sb.from("portfolio_items").select("*"),
    sb.from("playbook_entries").select("*").eq("aprovado", true),
  ]);
  const lead = opts.leadId ? await getLeadDetail(sb, opts.leadId) : null;
  let wins: Array<{ nicho: string; conversa: string }> = [];
  if (lead) {
    const { data } = await sb.from("deal_outcomes").select("nicho, conversa").eq("resultado", "ganho").eq("nicho", lead.nicho).order("criado_em", { ascending: false }).limit(5);
    wins = data ?? [];
  }
  const p = profile as Profile;
  return buildSystemPrompt({
    profile: p,
    services: (services ?? []) as Service[],
    portfolio: (portfolio ?? []) as PortfolioItem[],
    lead,
    interactions: lead?.interactions,
    deal: lead?.deal ? { etapa: lead.deal.etapa, entrou_na_etapa_em: lead.deal.entrou_na_etapa_em } : null,
    wins,
    playbook: (playbook ?? []) as PlaybookEntry[],
    now: opts.now ?? new Date(),
    mode: opts.mode,
    simulador: opts.simulador,
  });
}
