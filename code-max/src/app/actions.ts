"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/data";
import { moveDealStage, winDeal } from "@/lib/deals";
import { appUrl } from "@/lib/env";
import { NICHE_BY_KEY } from "@/lib/niches";
import { anthropic, friendlyApiError, ordeliryModel } from "@/lib/ordeliry/client";
import { PLAYBOOK_SEED } from "@/lib/ordeliry/playbook-seed";
import { ensureDiagnosis } from "@/lib/ordeliry/tools";
import { LOSS_REASONS, STAGES, STAGE_PROBABILITY, followupDueAt } from "@/lib/pipeline";
import { DEFAULT_WEIGHTS } from "@/lib/score";
import { requireUser, supabaseServer } from "@/lib/supabase/server";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function ctx() {
  const user = await requireUser();
  const sb = await supabaseServer();
  return { user, sb };
}

function err(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dados inválidos." };
  return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado." };
}

const money = z.coerce.number().min(0).max(10_000_000);
const lines = z.array(z.string().trim().min(1)).default([]);

// ---------------------------------------------------------------- perfil, catálogo, portfólio
const profileSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome").max(80),
  estudio: z.string().trim().max(80).default(""),
  whatsapp: z.string().trim().max(30).default(""),
  cidade_base: z.string().trim().max(80).default(""),
});

export async function saveProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const data = profileSchema.parse(input);
    await sb.from("profiles").update({ ...data, atualizado_em: new Date().toISOString() }).eq("user_id", user.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Dê um nome ao serviço").max(120),
  nichos: z.array(z.string()).default([]),
  descricao: z.string().trim().max(1000).default(""),
  inclui: lines,
  nao_inclui: lines,
  preco_implantacao: money,
  mensalidade: money,
  prazo_dias: z.coerce.number().int().min(1).max(365),
  ativo: z.boolean().default(true),
});

export async function upsertService(input: z.input<typeof serviceSchema>): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const { id, ...data } = serviceSchema.parse(input);
    const { error } = id ? await sb.from("services").update(data).eq("id", id) : await sb.from("services").insert({ ...data, user_id: user.id });
    if (error) throw new Error("Não foi possível salvar o serviço.");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function deleteService(id: string): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("services").delete().eq("id", z.string().uuid().parse(id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

const portfolioSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(1).max(120),
  url: z.string().trim().url("URL inválida"),
  nicho: z.string().default(""),
  destaque: z.boolean().default(false),
});

export async function upsertPortfolio(input: z.input<typeof portfolioSchema>): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const { id, ...data } = portfolioSchema.parse(input);
    if (id) await sb.from("portfolio_items").update(data).eq("id", id);
    else await sb.from("portfolio_items").insert({ ...data, user_id: user.id });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function deletePortfolio(id: string): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("portfolio_items").delete().eq("id", z.string().uuid().parse(id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

const settingsSchema = z.object({
  nichos_alvo: z.array(z.string().refine((k) => k in NICHE_BY_KEY)).optional(),
  regioes_alvo: z.array(z.object({ cidade: z.string().trim().min(1), bairros: z.array(z.string().trim()).default([]) })).optional(),
  meta_mensal: money.optional(),
  meta_contratos: z.coerce.number().int().min(0).max(1000).optional(),
  tom: z.enum(["formal", "equilibrado", "descontraido"]).optional(),
  horario_comercial: z.object({ inicio: z.string().regex(/^\d{2}:\d{2}$/), fim: z.string().regex(/^\d{2}:\d{2}$/), dias: z.array(z.number().int().min(0).max(6)) }).optional(),
  score_pesos: z.record(z.string(), z.number().min(-100).max(100)).nullable().optional(),
  places_limite_mensal: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  tema: z.enum(["system", "light", "dark"]).optional(),
});

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const data = settingsSchema.parse(input);
    if (data.score_pesos) {
      for (const k of Object.keys(data.score_pesos)) if (!(k in DEFAULT_WEIGHTS)) delete data.score_pesos[k];
    }
    await sb.from("profiles").update({ ...data, atualizado_em: new Date().toISOString() }).eq("user_id", user.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

/** Fim do onboarding: semeia o playbook inicial (aprovado e editável). */
export async function completeOnboarding(): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const { count } = await sb.from("playbook_entries").select("id", { count: "exact", head: true });
    if (!count) await sb.from("playbook_entries").insert(PLAYBOOK_SEED.map((p) => ({ ...p, user_id: user.id, fonte: "playbook_inicial", aprovado: true })));
    await sb.from("profiles").update({ onboarding_concluido: true }).eq("user_id", user.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------- leads
export async function saveLead(leadId: string): Promise<ActionResult<{ dealId: string }>> {
  try {
    const { user, sb } = await ctx();
    const id = z.string().uuid().parse(leadId);
    const { data: lead } = await sb.from("leads").select("id, nome, status, pacote_sugerido_id").eq("id", id).single();
    if (!lead) throw new Error("Lead não encontrado.");
    if (lead.status === "nao_contatar") throw new Error("Este lead está marcado como não contatar.");
    const { data: existing } = await sb.from("deals").select("id").eq("lead_id", id).not("etapa", "in", "(ganho,perdido)").maybeSingle();
    if (existing) return { ok: true, data: { dealId: existing.id } };
    let valor = 0;
    let mensal = 0;
    if (lead.pacote_sugerido_id) {
      const { data: s } = await sb.from("services").select("preco_implantacao, mensalidade").eq("id", lead.pacote_sugerido_id).maybeSingle();
      valor = Number(s?.preco_implantacao ?? 0);
      mensal = Number(s?.mensalidade ?? 0);
    }
    const { data: deal } = await sb
      .from("deals")
      .insert({ user_id: user.id, lead_id: id, service_id: lead.pacote_sugerido_id, valor_implantacao: valor, mensalidade: mensal, probabilidade: STAGE_PROBABILITY.novo })
      .select("id")
      .single();
    await sb.from("deal_stage_history").insert({ user_id: user.id, deal_id: deal!.id, de: null, para: "novo" });
    await sb.from("leads").update({ status: "salvo" }).eq("id", id);
    await logActivity(sb, user.id, "salvo", `${lead.nome} salvo no pipeline`, id);
    revalidatePath("/", "layout");
    return { ok: true, data: { dealId: deal!.id } };
  } catch (e) {
    return err(e);
  }
}

export async function discardLead(leadId: string): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("leads").update({ status: "descartado" }).eq("id", z.string().uuid().parse(leadId));
    revalidatePath("/radar");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

/** "Não contatar": respeitado em todas as buscas futuras (por place_id e telefone). */
export async function markDoNotContact(leadId: string, motivo?: string): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const { data: lead } = await sb.from("leads").select("id, place_id, telefone_internacional, telefone, nome").eq("id", z.string().uuid().parse(leadId)).single();
    if (!lead) throw new Error("Lead não encontrado.");
    await sb.from("do_not_contact").insert({
      user_id: user.id,
      place_id: lead.place_id,
      telefone: (lead.telefone_internacional ?? lead.telefone ?? "").replace(/\D/g, "") || null,
      nome: lead.nome,
      motivo: motivo ?? null,
    });
    await sb.from("leads").update({ status: "nao_contatar" }).eq("id", lead.id);
    await sb.from("deals").update({ etapa: "perdido", motivo_perda: "sem_interesse", motivo_perda_texto: "Pediu para não ser contatado", perdido_em: new Date().toISOString() }).eq("lead_id", lead.id).not("etapa", "in", "(ganho,perdido)");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function removeDoNotContact(id: string): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("do_not_contact").delete().eq("id", z.string().uuid().parse(id));
    revalidatePath("/ajustes");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------- pipeline
export async function moveStage(dealId: string, etapa: string, motivo?: string, motivoTexto?: string): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const stage = z.enum(STAGES).parse(etapa);
    if (stage === "ganho") throw new Error("Use o registro de ganho para informar valor e pagamento.");
    if (stage === "perdido") z.enum(Object.keys(LOSS_REASONS) as [string, ...string[]], { message: "Escolha o motivo da perda." }).parse(motivo);
    await moveDealStage(sb, user.id, z.string().uuid().parse(dealId), stage, { motivo, motivoTexto });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

const winSchema = z.object({
  dealId: z.string().uuid(),
  valor_implantacao: money,
  mensalidade: money,
  dia_vencimento: z.coerce.number().int().min(1).max(28).optional().nullable(),
  pagamento: z.object({ valor: money, forma: z.enum(["pix", "boleto", "cartao", "dinheiro"]), pago_em: z.string().min(10) }).optional().nullable(),
});

export async function registerWin(input: z.input<typeof winSchema>): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const { dealId, ...rest } = winSchema.parse(input);
    if (rest.pagamento) rest.pagamento.pago_em = new Date(rest.pagamento.pago_em).toISOString();
    await winDeal(sb, user.id, dealId, rest);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function updateDealValues(dealId: string, valor_implantacao: number, mensalidade: number): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("deals").update({ valor_implantacao: money.parse(valor_implantacao), mensalidade: money.parse(mensalidade) }).eq("id", z.string().uuid().parse(dealId));
    revalidatePath("/pipeline");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------- conversas e tarefas
const interactionSchema = z.object({
  leadId: z.string().uuid(),
  tipo: z.enum(["mensagem_enviada", "mensagem_recebida", "ligacao", "audio", "nota"]),
  texto: z.string().trim().min(1, "Escreva algo").max(20_000),
  origem: z.enum(["manual", "colado", "print", "ordeliry"]).default("manual"),
  ocorreu_em: z.string().optional(),
  autor: z.string().optional(),
});

export async function addInteraction(input: z.input<typeof interactionSchema>): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const d = interactionSchema.parse(input);
    const when = d.ocorreu_em ? new Date(d.ocorreu_em).toISOString() : new Date().toISOString();
    await sb.from("interactions").insert({ user_id: user.id, lead_id: d.leadId, tipo: d.tipo, texto: d.texto, origem: d.origem, ocorreu_em: when, autor: d.autor ?? null });
    if (d.tipo === "mensagem_enviada" || d.tipo === "ligacao") {
      await sb.from("leads").update({ ultimo_contato_em: when }).eq("id", d.leadId);
      // Primeiro contato move o negócio de "Novo" para "Contato feito".
      const { data: deal } = await sb.from("deals").select("id, etapa").eq("lead_id", d.leadId).eq("etapa", "novo").maybeSingle();
      if (deal) await moveDealStage(sb, user.id, deal.id, "contato");
      else {
        const { data: open } = await sb.from("deals").select("id, etapa").eq("lead_id", d.leadId).not("etapa", "in", "(ganho,perdido)").maybeSingle();
        if (open) await sb.from("deals").update({ proximo_followup_em: followupDueAt(open.etapa, new Date())?.toISOString() ?? null }).eq("id", open.id);
      }
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function saveTranscription(leadId: string, mensagens: Array<{ quem: "vendedor" | "cliente"; autor: string; texto: string; hora: string }>, data: string): Promise<ActionResult<{ salvas: number }>> {
  try {
    const { user, sb } = await ctx();
    const id = z.string().uuid().parse(leadId);
    const [d, m, y] = (data || "").split("/").map(Number);
    const base = d && m && y ? { y, m, d } : null;
    const { spDate, spParts } = await import("@/lib/dates");
    const today = spParts(new Date());
    const rows = mensagens.map((msg) => {
      const [hh, mm] = (msg.hora || "").split(":").map(Number);
      const b = base ?? { y: today.y, m: today.m, d: today.d };
      const when = Number.isFinite(hh) && Number.isFinite(mm) ? spDate(b.y, b.m, b.d, hh, mm) : new Date();
      return { user_id: user.id, lead_id: id, tipo: msg.quem === "vendedor" ? "mensagem_enviada" : "mensagem_recebida", autor: msg.autor, texto: msg.texto, origem: "print", ocorreu_em: when.toISOString() };
    });
    if (rows.length) await sb.from("interactions").insert(rows);
    revalidatePath("/conversas");
    return { ok: true, data: { salvas: rows.length } };
  } catch (e) {
    return err(e);
  }
}

export async function addTask(leadId: string | null, titulo: string, venceEm: string, mensagem?: string): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    await sb.from("tasks").insert({
      user_id: user.id,
      lead_id: leadId ? z.string().uuid().parse(leadId) : null,
      titulo: z.string().trim().min(1).max(200).parse(titulo),
      mensagem: mensagem ?? null,
      vence_em: new Date(venceEm).toISOString(),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function toggleTask(id: string, feita: boolean): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("tasks").update({ feita }).eq("id", z.string().uuid().parse(id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------- diagnóstico, propostas, rastreamento
export async function generateDiagnosis(leadId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const { user, sb } = await ctx();
    const url = await ensureDiagnosis(sb, user.id, z.string().uuid().parse(leadId));
    revalidatePath("/", "layout");
    return { ok: true, data: { url } };
  } catch (e) {
    return err(e);
  }
}

/** Token de rastreamento para um site de exemplo feito para o prospect. */
export async function createExampleTracker(leadId: string, url: string): Promise<ActionResult<{ token: string; snippet: string }>> {
  try {
    const { user, sb } = await ctx();
    const { data } = await sb
      .from("trackers")
      .insert({ user_id: user.id, lead_id: z.string().uuid().parse(leadId), tipo: "exemplo", url: z.string().url("URL inválida").parse(url) })
      .select("token")
      .single();
    revalidatePath("/", "layout");
    return { ok: true, data: { token: data!.token, snippet: `<script src="${appUrl()}/t.js" data-k="${data!.token}" defer></script>` } };
  } catch (e) {
    return err(e);
  }
}

export async function createProposal(dealId: string, serviceId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const { user, sb } = await ctx();
    const { data: deal } = await sb.from("deals").select("id, lead_id").eq("id", z.string().uuid().parse(dealId)).single();
    const { data: service } = await sb.from("services").select("*").eq("id", z.string().uuid().parse(serviceId)).single();
    if (!deal || !service) throw new Error("Negócio ou serviço não encontrado.");
    const { data: tracker } = await sb.from("trackers").insert({ user_id: user.id, lead_id: deal.lead_id, tipo: "proposta" }).select("id, token").single();
    const url = `${appUrl()}/p/${tracker!.token}`;
    await sb.from("trackers").update({ url }).eq("id", tracker!.id);
    await sb.from("proposals").insert({
      user_id: user.id,
      deal_id: deal.id,
      tracker_id: tracker!.id,
      enviada_em: new Date().toISOString(),
      conteudo_json: {
        servico: { nome: service.nome, descricao: service.descricao, inclui: service.inclui, nao_inclui: service.nao_inclui, preco_implantacao: service.preco_implantacao, mensalidade: service.mensalidade, prazo_dias: service.prazo_dias },
      },
    });
    await sb.from("deals").update({ service_id: service.id, valor_implantacao: service.preco_implantacao, mensalidade: service.mensalidade }).eq("id", deal.id);
    const { data: cur } = await sb.from("deals").select("etapa").eq("id", deal.id).single();
    if (cur && ["novo", "contato", "exemplo"].includes(cur.etapa)) await moveDealStage(sb, user.id, deal.id, "proposta");
    await logActivity(sb, user.id, "proposta", "Proposta gerada", deal.lead_id);
    revalidatePath("/", "layout");
    return { ok: true, data: { url } };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------- clientes e financeiro
const projectSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["briefing", "design", "desenvolvimento", "aprovacao", "no_ar", "manutencao"]).optional(),
  progresso: z.coerce.number().int().min(0).max(100).optional(),
  entrega_prevista: z.string().nullable().optional(),
  url_site: z.string().url().nullable().optional().or(z.literal("")),
});

export async function updateProject(input: z.input<typeof projectSchema>): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    const { id, ...d } = projectSchema.parse(input);
    await sb.from("projects").update({ ...d, url_site: d.url_site || null }).eq("id", id);
    revalidatePath("/clientes");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

const paymentSchema = z.object({
  clientId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional().nullable(),
  valor: z.coerce.number().positive("Valor precisa ser maior que zero").max(10_000_000),
  forma: z.enum(["pix", "boleto", "cartao", "dinheiro"]),
  pago_em: z.string().min(10),
  referencia: z.string().max(200).optional(),
});

export async function addPayment(input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const d = paymentSchema.parse(input);
    await sb.from("payments").insert({
      user_id: user.id,
      client_id: d.clientId,
      subscription_id: d.subscriptionId ?? null,
      valor: d.valor,
      forma: d.forma,
      pago_em: new Date(d.pago_em).toISOString(),
      referencia: d.referencia ?? null,
    });
    const { data: c } = await sb.from("clients").select("nome, lead_id").eq("id", d.clientId).single();
    await logActivity(sb, user.id, "pagamento", `Pagamento recebido de ${c?.nome}: R$ ${d.valor.toLocaleString("pt-BR")}`, c?.lead_id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function toggleSubscription(id: string, ativa: boolean): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("subscriptions").update({ ativa }).eq("id", z.string().uuid().parse(id));
    revalidatePath("/clientes");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------- playbook
export async function savePlaybookEntry(input: { id?: string; titulo: string; nicho?: string | null; conteudo: string; aprovado?: boolean; fonte?: string }): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const d = z
      .object({ id: z.string().uuid().optional(), titulo: z.string().trim().min(1).max(200), nicho: z.string().nullable().optional(), conteudo: z.string().trim().min(1).max(30_000), aprovado: z.boolean().optional(), fonte: z.string().optional() })
      .parse(input);
    if (d.id) await sb.from("playbook_entries").update({ titulo: d.titulo, nicho: d.nicho ?? null, conteudo: d.conteudo, aprovado: d.aprovado }).eq("id", d.id);
    else await sb.from("playbook_entries").insert({ user_id: user.id, titulo: d.titulo, nicho: d.nicho ?? null, conteudo: d.conteudo, aprovado: d.aprovado ?? false, fonte: d.fonte ?? "manual" });
    revalidatePath("/playbook");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function deletePlaybookEntry(id: string): Promise<ActionResult> {
  try {
    const { sb } = await ctx();
    await sb.from("playbook_entries").delete().eq("id", z.string().uuid().parse(id));
    revalidatePath("/playbook");
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

/** Extrai lições de uma conversa ou transcrição colada. Fica como rascunho até o vendedor aprovar. */
export async function extractLessons(texto: string, nicho: string | null): Promise<ActionResult> {
  try {
    const { user, sb } = await ctx();
    const raw = z.string().trim().min(40, "Cole a conversa ou transcrição completa.").max(60_000).parse(texto);
    const res = await anthropic().messages.create({
      model: ordeliryModel(),
      max_tokens: 4000,
      output_config: { effort: "medium" },
      system:
        "Você extrai lições de vendas consultivas de sites para negócios locais, a partir de conversas reais de WhatsApp ou transcrições de ligações. Seja fiel ao material: não invente falas, números ou resultados. Responda em português do Brasil, em markdown curto, com as seções: **O que aconteceu**, **O que funcionou**, **O que atrapalhou**, **Lições** (lista), **Frases que valem copiar** (só as que aparecem no material).",
      messages: [{ role: "user", content: raw }],
    });
    if (res.stop_reason === "refusal") throw new Error("Não foi possível analisar este material.");
    const conteudo = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const titulo = `Lições extraídas · ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
    await sb.from("playbook_entries").insert({ user_id: user.id, titulo, nicho, conteudo: `${conteudo}\n\n---\nMaterial original:\n${raw.slice(0, 8000)}`, fonte: "extraido_ordeliry", aprovado: false });
    revalidatePath("/playbook");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyApiError(e) };
  }
}
