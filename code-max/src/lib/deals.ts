import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "./data";
import { nicheLabel } from "./niches";
import { followupDueAt, LOSS_REASONS, STAGE_LABEL, type LossReason, type Stage } from "./pipeline";
import { formatHistory } from "./ordeliry/context";
import type { Interaction } from "./types";

async function saveOutcome(sb: SupabaseClient, userId: string, deal: { id: string; lead_id: string }, resultado: "ganho" | "perdido") {
  const [{ data: lead }, { data: ints }, { data: profile }] = await Promise.all([
    sb.from("leads").select("nicho").eq("id", deal.lead_id).single(),
    sb.from("interactions").select("*").eq("lead_id", deal.lead_id).order("ocorreu_em"),
    sb.from("profiles").select("nome").eq("user_id", userId).single(),
  ]);
  await sb.from("deal_outcomes").insert({
    user_id: userId,
    deal_id: deal.id,
    lead_id: deal.lead_id,
    nicho: lead?.nicho ?? "",
    resultado,
    conversa: formatHistory((ints ?? []) as Interaction[], profile?.nome ?? ""),
  });
}

export async function moveDealStage(sb: SupabaseClient, userId: string, dealId: string, etapa: Stage, opts: { motivo?: string; motivoTexto?: string } = {}) {
  const { data: deal } = await sb.from("deals").select("id, lead_id, etapa").eq("id", dealId).single();
  if (!deal) throw new Error("Negócio não encontrado.");
  if (deal.etapa === etapa) return;
  if (etapa === "perdido" && !opts.motivo) throw new Error("Perdido exige motivo.");
  const now = new Date();
  const update: Record<string, unknown> = {
    etapa,
    entrou_na_etapa_em: now.toISOString(),
    proximo_followup_em: followupDueAt(etapa, now)?.toISOString() ?? null,
  };
  if (etapa === "perdido") {
    update.motivo_perda = opts.motivo as LossReason;
    update.motivo_perda_texto = opts.motivoTexto ?? null;
    update.perdido_em = now.toISOString();
  }
  await sb.from("deals").update(update).eq("id", dealId);
  await sb.from("deal_stage_history").insert({ user_id: userId, deal_id: dealId, de: deal.etapa, para: etapa });
  if (etapa === "contato") await sb.from("leads").update({ ultimo_contato_em: now.toISOString() }).eq("id", deal.lead_id);
  const { data: lead } = await sb.from("leads").select("nome").eq("id", deal.lead_id).single();
  await logActivity(
    sb,
    userId,
    etapa === "perdido" ? "perdido" : "etapa",
    etapa === "perdido"
      ? `${lead?.nome} perdido: ${LOSS_REASONS[opts.motivo as LossReason]}`
      : `${lead?.nome} → ${STAGE_LABEL[etapa]}`,
    deal.lead_id,
  );
  if (etapa === "perdido") await saveOutcome(sb, userId, deal, "perdido");
}

export type WinInput = {
  valor_implantacao: number;
  mensalidade: number;
  dia_vencimento?: number | null;
  pagamento?: { valor: number; forma: "pix" | "boleto" | "cartao" | "dinheiro"; pago_em: string } | null;
};

/** Ganho: registra contrato, cria cliente, projeto, assinatura e (se houver) o primeiro pagamento. */
export async function winDeal(sb: SupabaseClient, userId: string, dealId: string, input: WinInput) {
  const { data: deal } = await sb.from("deals").select("id, lead_id, etapa, service_id").eq("id", dealId).single();
  if (!deal) throw new Error("Negócio não encontrado.");
  const now = new Date().toISOString();
  const { data: lead } = await sb.from("leads").select("nome, nicho, telefone").eq("id", deal.lead_id).single();
  await sb
    .from("deals")
    .update({ etapa: "ganho", entrou_na_etapa_em: now, ganho_em: now, proximo_followup_em: null, valor_implantacao: input.valor_implantacao, mensalidade: input.mensalidade })
    .eq("id", dealId);
  await sb.from("deal_stage_history").insert({ user_id: userId, deal_id: dealId, de: deal.etapa, para: "ganho" });
  await sb.from("leads").update({ status: "cliente" }).eq("id", deal.lead_id);

  const { data: client } = await sb
    .from("clients")
    .insert({ user_id: userId, lead_id: deal.lead_id, deal_id: dealId, nome: lead?.nome ?? "Cliente", nicho: lead?.nicho ?? "", telefone: lead?.telefone ?? null })
    .select("id")
    .single();
  if (!client) throw new Error("Falha ao criar cliente.");
  let servico = "Site";
  if (deal.service_id) {
    const { data: s } = await sb.from("services").select("nome, prazo_dias").eq("id", deal.service_id).maybeSingle();
    if (s) servico = s.nome;
  }
  await sb.from("projects").insert({ user_id: userId, client_id: client.id, titulo: `${servico} · ${lead?.nome ?? ""}` });
  if (input.mensalidade > 0) {
    await sb.from("subscriptions").insert({ user_id: userId, client_id: client.id, valor: input.mensalidade, dia_vencimento: Math.min(28, Math.max(1, input.dia_vencimento ?? new Date().getDate())) });
  }
  if (input.pagamento && input.pagamento.valor > 0) {
    await sb.from("payments").insert({ user_id: userId, client_id: client.id, deal_id: dealId, valor: input.pagamento.valor, forma: input.pagamento.forma, pago_em: input.pagamento.pago_em, referencia: "Primeiro pagamento" });
  }
  await logActivity(sb, userId, "ganho", `Contrato fechado: ${lead?.nome} (${nicheLabel(lead?.nicho ?? "")})`, deal.lead_id);
  await saveOutcome(sb, userId, deal, "ganho");
  return client.id as string;
}
