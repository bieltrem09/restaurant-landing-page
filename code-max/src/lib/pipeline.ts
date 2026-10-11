export const STAGES = ["novo", "contato", "exemplo", "proposta", "negociacao", "ganho", "perdido"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  novo: "Novo",
  contato: "Contato feito",
  exemplo: "Diagnóstico/Exemplo enviado",
  proposta: "Proposta",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

/** Probabilidade padrão de fechamento por etapa, usada na previsão ponderada. */
export const STAGE_PROBABILITY: Record<Stage, number> = {
  novo: 0.05,
  contato: 0.15,
  exemplo: 0.3,
  proposta: 0.5,
  negociacao: 0.7,
  ganho: 1,
  perdido: 0,
};

/** Prazo padrão de follow-up (dias) por etapa. */
export const STAGE_FOLLOWUP_DAYS: Partial<Record<Stage, number>> = {
  contato: 2,
  exemplo: 1,
  proposta: 2,
  negociacao: 1,
};

export const LOSS_REASONS = {
  preco: "Preço",
  sumiu: "Sumiu",
  ja_tem_fornecedor: "Já tem fornecedor",
  sem_interesse: "Sem interesse",
  timing: "Timing",
  decisor_nao_alcancado: "Decisor não alcançado",
  outro: "Outro",
} as const;
export type LossReason = keyof typeof LOSS_REASONS;

export function nextStage(s: Stage): Stage | null {
  const order: Stage[] = ["novo", "contato", "exemplo", "proposta", "negociacao", "ganho"];
  const i = order.indexOf(s);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function followupDueAt(stage: Stage, enteredAt: Date): Date | null {
  const d = STAGE_FOLLOWUP_DAYS[stage];
  if (!d) return null;
  return new Date(enteredAt.getTime() + d * 86_400_000);
}

const DAY = 86_400_000;

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY);
}

export type DealLike = {
  etapa: Stage;
  valor_implantacao: number;
  mensalidade: number;
  probabilidade?: number | null;
  criado_em: string;
  ganho_em?: string | null;
};

/** Valor de um negócio para totais: implantação + 12 meses de mensalidade (LTV de um ano). */
export function dealValue(d: Pick<DealLike, "valor_implantacao" | "mensalidade">): number {
  return Number(d.valor_implantacao) + Number(d.mensalidade) * 12;
}

export function pipelineTotals(deals: DealLike[], now: Date, monthStart: Date) {
  const open = deals.filter((d) => d.etapa !== "ganho" && d.etapa !== "perdido");
  const emAberto = open.reduce((s, d) => s + dealValue(d), 0);
  const ponderada = open.reduce((s, d) => s + dealValue(d) * (d.probabilidade ?? STAGE_PROBABILITY[d.etapa]), 0);
  const won = deals.filter((d) => d.etapa === "ganho" && d.ganho_em);
  const ganhosMes = won.filter((d) => new Date(d.ganho_em!) >= monthStart && new Date(d.ganho_em!) <= now);
  const ciclos = won.map((d) => (new Date(d.ganho_em!).getTime() - new Date(d.criado_em).getTime()) / DAY);
  const cicloMedio = ciclos.length ? ciclos.reduce((a, b) => a + b, 0) / ciclos.length : null;
  return {
    emAberto,
    ponderada,
    ganhosMes: ganhosMes.reduce((s, d) => s + dealValue(d), 0),
    ganhosMesQtd: ganhosMes.length,
    cicloMedioDias: cicloMedio,
  };
}
