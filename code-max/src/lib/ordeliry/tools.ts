import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logActivity } from "../data";
import { STAGES, STAGE_LABEL, LOSS_REASONS, type Stage } from "../pipeline";
import { formatHistory, formatLead } from "./context";
import type { Interaction, Lead, LeadSignal } from "../types";
import { appUrl } from "../env";
import { moveDealStage } from "../deals";

const uuid = z.string().uuid();

/** Esquemas Zod: validam o input do modelo antes de qualquer execução. */
export const TOOL_SCHEMAS = {
  get_lead: z.object({ lead_id: uuid }),
  search_leads: z.object({
    nicho: z.string().optional(),
    faixa: z.enum(["quente", "morno", "frio"]).optional(),
    status: z.enum(["novo", "salvo", "cliente"]).optional(),
    sem_site: z.boolean().optional(),
    nome: z.string().optional(),
    limite: z.number().int().min(1).max(25).optional(),
  }),
  get_conversation: z.object({ lead_id: uuid }),
  save_note: z.object({ lead_id: uuid, texto: z.string().min(1).max(4000) }),
  create_followup: z.object({ lead_id: uuid, data_hora: z.string().min(10), mensagem: z.string().min(1).max(4000) }),
  move_stage: z.object({ lead_id: uuid, etapa: z.enum(STAGES), motivo: z.enum(Object.keys(LOSS_REASONS) as [string, ...string[]]).optional() }),
  generate_diagnosis_link: z.object({ lead_id: uuid }),
  log_message: z.object({ lead_id: uuid, direcao: z.enum(["enviada", "recebida"]), texto: z.string().min(1).max(8000) }),
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

/** Ferramentas que só leem: executadas direto. As demais gravam e exigem confirmação do vendedor. */
export const READ_ONLY: ReadonlySet<ToolName> = new Set(["get_lead", "search_leads", "get_conversation"]);

const obj = (properties: Record<string, unknown>, required: string[]): Anthropic.Tool.InputSchema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const leadId = { type: "string", description: "ID (uuid) do lead no CRM" };

export const TOOLS: Anthropic.Tool[] = [
  { name: "get_lead", description: "Lê a ficha completa de um lead: dados, sinais verificados com fonte e data, score, etapa.", input_schema: obj({ lead_id: leadId }, ["lead_id"]) },
  {
    name: "search_leads",
    description: "Busca leads do vendedor por filtros. Use para achar o lead certo antes de outras ações.",
    input_schema: obj(
      {
        nicho: { type: "string", description: "chave do nicho, ex.: pizzaria, dentista, advogado" },
        faixa: { type: "string", enum: ["quente", "morno", "frio"] },
        status: { type: "string", enum: ["novo", "salvo", "cliente"] },
        sem_site: { type: "boolean" },
        nome: { type: "string", description: "parte do nome" },
        limite: { type: "integer", minimum: 1, maximum: 25 },
      },
      [],
    ),
  },
  { name: "get_conversation", description: "Lê o histórico de conversa registrado com o lead.", input_schema: obj({ lead_id: leadId }, ["lead_id"]) },
  { name: "save_note", description: "Salva uma anotação interna no lead. O vendedor confirma antes.", input_schema: obj({ lead_id: leadId, texto: { type: "string" } }, ["lead_id", "texto"]) },
  {
    name: "create_followup",
    description: "Agenda um follow-up com a mensagem pronta. data_hora em ISO 8601 com fuso -03:00. O vendedor confirma antes.",
    input_schema: obj({ lead_id: leadId, data_hora: { type: "string" }, mensagem: { type: "string" } }, ["lead_id", "data_hora", "mensagem"]),
  },
  {
    name: "move_stage",
    description: `Move o negócio do lead para outra etapa do pipeline (${STAGES.join(", ")}). Para "perdido", informe o motivo. O vendedor confirma antes.`,
    input_schema: obj({ lead_id: leadId, etapa: { type: "string", enum: [...STAGES] }, motivo: { type: "string", enum: Object.keys(LOSS_REASONS) } }, ["lead_id", "etapa"]),
  },
  { name: "generate_diagnosis_link", description: "Gera (ou reaproveita) o link público do diagnóstico do lead. O vendedor confirma antes.", input_schema: obj({ lead_id: leadId }, ["lead_id"]) },
  {
    name: "log_message",
    description: "Registra no histórico uma mensagem enviada ou recebida. O vendedor confirma antes.",
    input_schema: obj({ lead_id: leadId, direcao: { type: "string", enum: ["enviada", "recebida"] }, texto: { type: "string" } }, ["lead_id", "direcao", "texto"]),
  },
].map((t) => ({ ...t, eager_input_streaming: true }));

export function describeAction(name: ToolName, input: Record<string, unknown>): string {
  switch (name) {
    case "save_note":
      return `Salvar anotação: “${input.texto}”`;
    case "create_followup":
      return `Agendar follow-up para ${new Date(String(input.data_hora)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
    case "move_stage":
      return `Mover para “${STAGE_LABEL[input.etapa as Stage] ?? input.etapa}”${input.motivo ? ` (motivo: ${LOSS_REASONS[input.motivo as keyof typeof LOSS_REASONS]})` : ""}`;
    case "generate_diagnosis_link":
      return "Gerar link público do diagnóstico";
    case "log_message":
      return `Registrar mensagem ${input.direcao}: “${String(input.texto).slice(0, 140)}”`;
    default:
      return name;
  }
}

export async function ensureDiagnosis(sb: SupabaseClient, userId: string, leadId: string): Promise<string> {
  const { data: existing } = await sb.from("trackers").select("token").eq("lead_id", leadId).eq("tipo", "diagnostico").maybeSingle();
  if (existing) return `${appUrl()}/d/${existing.token}`;
  const { data: tracker, error } = await sb.from("trackers").insert({ user_id: userId, lead_id: leadId, tipo: "diagnostico" }).select("id, token").single();
  if (error || !tracker) throw new Error("Não foi possível gerar o link.");
  await sb.from("trackers").update({ url: `${appUrl()}/d/${tracker.token}` }).eq("id", tracker.id);
  await logActivity(sb, userId, "diagnostico", "Diagnóstico gerado", leadId);
  return `${appUrl()}/d/${tracker.token}`;
}

/** Executa uma ferramenta já validada. Retorna o texto do tool_result. */
export async function runTool(sb: SupabaseClient, userId: string, vendedor: string, name: ToolName, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "get_lead": {
      const { data: lead } = await sb.from("leads").select("*").eq("id", input.lead_id).maybeSingle();
      if (!lead) return "Lead não encontrado.";
      const { data: signals } = await sb.from("lead_signals").select("*").eq("lead_id", lead.id);
      const { data: deal } = await sb.from("deals").select("etapa, entrou_na_etapa_em").eq("lead_id", lead.id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      return `${formatLead({ ...(lead as Lead), signals: (signals ?? []) as LeadSignal[] })}\nEtapa: ${deal ? STAGE_LABEL[deal.etapa as Stage] : "fora do pipeline"}\nID: ${lead.id}`;
    }
    case "search_leads": {
      let q = sb.from("leads").select("id, nome, nicho, bairro, score, faixa, website, rating, rating_count, status").neq("status", "nao_contatar").order("score", { ascending: false }).limit(Number(input.limite ?? 10));
      if (input.nicho) q = q.eq("nicho", input.nicho);
      if (input.faixa) q = q.eq("faixa", input.faixa);
      if (input.status) q = q.eq("status", input.status);
      if (input.sem_site) q = q.is("website", null);
      if (input.nome) q = q.ilike("nome", `%${String(input.nome).replace(/[%_]/g, "")}%`);
      const { data } = await q;
      if (!data?.length) return "Nenhum lead encontrado com esses filtros.";
      return data.map((l) => `- ${l.nome} (${l.nicho}, ${l.bairro ?? "bairro ?"}) · score ${l.score} ${l.faixa} · site: ${l.website ?? "nenhum"} · nota ${l.rating ?? "?"} (${l.rating_count ?? "?"}) · id ${l.id}`).join("\n");
    }
    case "get_conversation": {
      const { data } = await sb.from("interactions").select("*").eq("lead_id", input.lead_id).order("ocorreu_em");
      return formatHistory((data ?? []) as Interaction[], vendedor);
    }
    case "save_note": {
      await sb.from("interactions").insert({ user_id: userId, lead_id: input.lead_id, tipo: "nota", texto: input.texto, origem: "ordeliry" });
      return "Anotação salva.";
    }
    case "create_followup": {
      const when = new Date(String(input.data_hora));
      if (Number.isNaN(when.getTime())) return "Data inválida.";
      await sb.from("tasks").insert({ user_id: userId, lead_id: input.lead_id, titulo: "Follow-up", mensagem: input.mensagem, vence_em: when.toISOString() });
      await sb.from("deals").update({ proximo_followup_em: when.toISOString() }).eq("lead_id", input.lead_id).not("etapa", "in", "(ganho,perdido)");
      return `Follow-up agendado para ${when.toISOString()}.`;
    }
    case "move_stage": {
      const etapa = input.etapa as Stage;
      if (etapa === "perdido" && !input.motivo) return "Para mover para Perdido é preciso informar o motivo.";
      if (etapa === "ganho") return "Para marcar como Ganho, o vendedor precisa registrar o valor e o primeiro pagamento pelo Pipeline. Oriente-o a fazer isso lá.";
      const { data: deal } = await sb.from("deals").select("id").eq("lead_id", input.lead_id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
      if (!deal) return "Este lead ainda não está no pipeline.";
      await moveDealStage(sb, userId, deal.id, etapa, { motivo: input.motivo as string | undefined });
      return `Movido para ${STAGE_LABEL[etapa]}.`;
    }
    case "generate_diagnosis_link":
      return `Link do diagnóstico: ${await ensureDiagnosis(sb, userId, String(input.lead_id))}`;
    case "log_message": {
      await sb.from("interactions").insert({
        user_id: userId,
        lead_id: input.lead_id,
        tipo: input.direcao === "enviada" ? "mensagem_enviada" : "mensagem_recebida",
        texto: input.texto,
        origem: "ordeliry",
      });
      if (input.direcao === "enviada") await sb.from("leads").update({ ultimo_contato_em: new Date().toISOString() }).eq("id", input.lead_id);
      return "Mensagem registrada.";
    }
  }
}
