import { TZ } from "../dates";
import { nicheLabel } from "../niches";
import { STAGE_LABEL, type Stage } from "../pipeline";
import type { Interaction, Lead, LeadSignal, PlaybookEntry, PortfolioItem, Profile, Service } from "../types";
import { ORDELIRY_SYSTEM_TEMPLATE } from "./system-prompt-template";

export const MODES = {
  auto: "Automático",
  abordagem: "Abordagem",
  responder: "Responder cliente",
  analisar: "Analisar conversa",
  followup: "Follow-up",
  roteiro: "Roteiro de ligação",
  simulador: "Simulador",
  proposta: "Proposta",
} as const;
export type Mode = keyof typeof MODES;

export type OrdeliryContextInput = {
  profile: Pick<Profile, "nome" | "estudio" | "tom" | "horario_comercial" | "whatsapp">;
  services: Service[];
  portfolio: PortfolioItem[];
  lead?: (Lead & { signals: LeadSignal[]; pacote?: Service | null }) | null;
  interactions?: Interaction[];
  deal?: { etapa: Stage; entrou_na_etapa_em: string } | null;
  wins?: Array<{ nicho: string; conversa: string }>;
  playbook: PlaybookEntry[];
  now: Date;
  mode?: Mode;
  simulador?: { nicho: string; dificuldade: "facil" | "media" | "dificil" };
};

const TOM_LABEL = { formal: "mais formal", equilibrado: "equilibrado", descontraido: "mais descontraído" } as const;

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatCatalog(services: Service[]): string {
  const active = services.filter((s) => s.ativo);
  if (!active.length) return "(VAZIO — nenhum serviço cadastrado. Não cite preço, prazo ou entrega: peça ao vendedor.)";
  return active
    .map((s) =>
      [
        `- ${s.nome}`,
        `  Para: ${s.nichos.length ? s.nichos.map(nicheLabel).join(", ") : "qualquer nicho"}`,
        s.descricao ? `  Descrição: ${s.descricao}` : null,
        `  Implantação: ${brl(Number(s.preco_implantacao))} · Mensalidade: ${brl(Number(s.mensalidade))} · Prazo: ${s.prazo_dias} dias`,
        s.inclui.length ? `  Inclui: ${s.inclui.join("; ")}` : null,
        s.nao_inclui.length ? `  NÃO inclui: ${s.nao_inclui.join("; ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

export function formatPortfolio(items: PortfolioItem[]): string {
  if (!items.length) return "(vazio)";
  return items.map((p) => `- ${p.titulo} (${nicheLabel(p.nicho) || "sem nicho"}): ${p.url}`).join("\n");
}

function signalValue(v: unknown): string {
  if (v === null || v === undefined) return "não verificado";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function formatLead(lead: OrdeliryContextInput["lead"]): string {
  if (!lead) return "(nenhum lead selecionado — conversa geral)";
  const lines = [
    `Nome: ${lead.nome}`,
    `Nicho: ${nicheLabel(lead.nicho)}`,
    `Endereço: ${lead.endereco ?? "não verificado"}${lead.bairro ? ` (bairro ${lead.bairro})` : ""}`,
    `Telefone: ${lead.telefone ?? "não verificado"}`,
    `Site: ${lead.website ?? "nenhum no Google"}`,
    `Instagram: ${lead.instagram ?? "não encontrado"}`,
    `Nota no Google: ${lead.rating ?? "não verificado"} (${lead.rating_count ?? "?"} avaliações)`,
    `Score de fechamento: ${lead.score}/100 (${lead.faixa})`,
    `Pacote sugerido: ${lead.pacote ? lead.pacote.nome : "nenhum"}`,
    "Sinais verificados (fonte, data):",
    ...lead.signals.map(
      (s) => `  - ${s.chave}: ${signalValue(s.valor_json)} · ${s.pontos > 0 ? `+${s.pontos} pts` : "0 pts"} · fonte ${s.fonte} · ${new Date(s.coletado_em).toLocaleDateString("pt-BR", { timeZone: TZ })}`,
    ),
  ];
  return lines.join("\n");
}

export function formatHistory(items: Interaction[] | undefined, vendedor: string): string {
  if (!items?.length) return "(sem conversas registradas)";
  const label: Record<Interaction["tipo"], string> = {
    mensagem_enviada: vendedor || "Vendedor",
    mensagem_recebida: "Cliente",
    ligacao: "Ligação",
    audio: "Áudio",
    nota: "Nota interna",
  };
  return items
    .slice(-60)
    .map((i) => {
      const when = new Date(i.ocorreu_em).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
      const who = i.tipo === "mensagem_recebida" && i.autor ? i.autor : label[i.tipo];
      return `[${when}] ${who}: ${i.texto}`;
    })
    .join("\n");
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-z_.]+)\}\}/g, (all, key: string) => (key in vars ? vars[key] : all));
}

/** Monta o `system` da Ordeliry: prompt literal da seção 6 com as variáveis preenchidas + playbook aprovado. */
export function buildSystemPrompt(input: OrdeliryContextInput): string {
  const { profile, now } = input;
  const dias = input.deal ? Math.floor((now.getTime() - new Date(input.deal.entrou_na_etapa_em).getTime()) / 86_400_000) : null;
  const h = profile.horario_comercial;
  const diasSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const vars: Record<string, string> = {
    "vendedor.nome": profile.nome || "o vendedor",
    "vendedor.estudio": profile.estudio || "(estúdio não informado)",
    catalogo: `\n${formatCatalog(input.services)}`,
    portfolio: `\n${formatPortfolio(input.portfolio)}`,
    lead: `\n${formatLead(input.lead)}`,
    historico: `\n${formatHistory(input.interactions, profile.nome)}`,
    etapa: input.deal ? STAGE_LABEL[input.deal.etapa] : "fora do pipeline",
    dias_na_etapa: dias === null ? "—" : String(dias),
    exemplos_ganhos: input.wins?.length ? `\n${input.wins.map((w, i) => `### Ganho ${i + 1} (${nicheLabel(w.nicho)})\n${w.conversa}`).join("\n\n")}` : "(nenhum ainda)",
    // Resolução de hora (não minuto) para o prefixo do prompt continuar cacheável dentro da hora.
    data_hora: `${now.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}, por volta das ${now.toLocaleString("pt-BR", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" })}h`,
    horario: `${h.dias.map((d) => diasSemana[d]).join(", ")} das ${h.inicio} às ${h.fim}`,
    tom: TOM_LABEL[profile.tom],
  };
  const playbook = input.playbook.filter((p) => p.aprovado);
  const parts = [
    fillTemplate(ORDELIRY_SYSTEM_TEMPLATE, vars),
    "",
    "## Playbook do vendedor (conhecimento extraído de conversas e vídeos reais)",
    playbook.length ? playbook.map((p) => `### ${p.titulo}${p.nicho ? ` [${nicheLabel(p.nicho)}]` : ""}\n${p.conteudo}`).join("\n\n") : "(vazio)",
    "",
    "## Ferramentas",
    "Você pode propor ações no CRM usando as ferramentas. Toda ação que grava algo é mostrada ao vendedor e só é executada depois que ele confirmar.",
  ];
  if (input.mode && input.mode !== "auto") parts.push("", `## Modo atual: ${MODES[input.mode]}`);
  if (input.mode === "simulador" && input.simulador)
    parts.push(`Interprete o dono de um negócio do nicho ${nicheLabel(input.simulador.nicho)}, dificuldade ${input.simulador.dificuldade}. Fique no personagem até o vendedor escrever "fim do treino".`);
  return parts.join("\n");
}
