import {
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  addDaysSP,
  greetingSP,
  monthName,
  periodRange,
  previousRange,
  spDate,
  spParts,
  type Period,
  type Range,
} from "./dates";
import { STAGES, type Stage } from "./pipeline";

export type PaymentRow = { valor: number; pago_em: string; nicho?: string | null };
export type WonDealRow = { ganho_em: string; valor_implantacao: number; mensalidade: number };
export type ApproachRow = { lead_id: string; em: string };

export type Bucket = { label: string; from: Date; to: Date };

/** Divide o período em barras: dia → blocos de 2h, semana → dias, mês → dias, ano → meses, custom → dias (ou semanas se > 62 dias). */
export function buckets(period: Period, r: Range): Bucket[] {
  const out: Bucket[] = [];
  if (period === "dia") {
    const p = spParts(r.from);
    for (let h = 0; h < 24; h += 2) out.push({ label: `${String(h).padStart(2, "0")}h`, from: spDate(p.y, p.m, p.d, h), to: spDate(p.y, p.m, p.d, h + 2) });
    return out;
  }
  if (period === "ano") {
    const p = spParts(r.from);
    for (let m = 0; m < 12; m++) out.push({ label: MONTHS_SHORT[m], from: spDate(p.y, m + 1, 1), to: spDate(p.y, m + 2, 1) });
    return out;
  }
  const days = Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000);
  const step = period === "custom" && days > 62 ? 7 : 1;
  for (let cur = r.from; cur < r.to; ) {
    const next = addDaysSP(cur, step);
    const to = next > r.to ? r.to : next;
    const p = spParts(cur);
    const label = period === "semana" ? WEEKDAYS_SHORT[p.dow] : `${p.d}/${p.m}`;
    out.push({ label: period === "mes" ? String(p.d) : label, from: cur, to });
    cur = to;
  }
  return out;
}

function inRange(iso: string, r: { from: Date; to: Date }): boolean {
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t < r.to.getTime();
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}

export type Kpis = {
  faturamento: number;
  contratos: number;
  ticketMedio: number | null;
  conversao: number | null;
  abordados: number;
};

export function kpisFor(r: Range, payments: PaymentRow[], won: WonDealRow[], approaches: ApproachRow[]): Kpis {
  const pays = payments.filter((p) => inRange(p.pago_em, r));
  const faturamento = sum(pays.map((p) => Number(p.valor)));
  const wonIn = won.filter((d) => inRange(d.ganho_em, r));
  const contratos = wonIn.length;
  const abordados = new Set(approaches.filter((a) => inRange(a.em, r)).map((a) => a.lead_id)).size;
  return {
    faturamento,
    contratos,
    ticketMedio: contratos ? sum(wonIn.map((d) => Number(d.valor_implantacao) + Number(d.mensalidade))) / contratos : null,
    conversao: abordados ? (contratos / abordados) * 100 : null,
    abordados,
  };
}

export type ChartBar = {
  label: string;
  atual: number | null;
  anterior: number | null;
  projecao: number | null;
  pagamentos: number;
  futuro: boolean;
  agora: boolean;
};

/** Média diária de recebimentos nos últimos 30 dias até `now`. */
export function dailyMovingAverage(payments: PaymentRow[], now: Date): number {
  const r = { from: addDaysSP(now, -30), to: now };
  return sum(payments.filter((p) => inRange(p.pago_em, r)).map((p) => Number(p.valor))) / 30;
}

export function revenueSeries(period: Period, r: Range, prev: Range, payments: PaymentRow[], now: Date): ChartBar[] {
  const cur = buckets(period, r);
  const old = buckets(period, prev);
  const avg = dailyMovingAverage(payments, now);
  return cur.map((b, i) => {
    const futuro = b.from.getTime() > now.getTime();
    const agora = b.from.getTime() <= now.getTime() && now.getTime() < b.to.getTime();
    const ps = payments.filter((p) => inRange(p.pago_em, b));
    const pb = old[i];
    const days = (b.to.getTime() - b.from.getTime()) / 86_400_000;
    return {
      label: b.label,
      atual: futuro ? null : sum(ps.map((p) => Number(p.valor))),
      anterior: pb ? sum(payments.filter((p) => inRange(p.pago_em, pb)).map((p) => Number(p.valor))) : null,
      projecao: futuro && avg > 0 ? Math.round(avg * days * 100) / 100 : null,
      pagamentos: ps.length,
      futuro,
      agora,
    };
  });
}

export function revenueByNiche(payments: PaymentRow[], r: Range): Array<{ nicho: string; valor: number }> {
  const m = new Map<string, number>();
  for (const p of payments) {
    if (!inRange(p.pago_em, r)) continue;
    const k = p.nicho || "outros";
    m.set(k, (m.get(k) ?? 0) + Number(p.valor));
  }
  return [...m.entries()].map(([nicho, valor]) => ({ nicho, valor })).sort((a, b) => b.valor - a.valor);
}

export type GoalProgress = {
  meta: number;
  recebido: number;
  pct: number;
  falta: number;
  semanasRestantes: number;
  contratosPorSemana: number | null;
};

export function goalProgress(meta: number, recebidoMes: number, ticketMedio: number | null, now: Date): GoalProgress {
  const p = spParts(now);
  const end = spDate(p.y, p.m + 1, 1);
  const diasRestantes = Math.max(0, (end.getTime() - now.getTime()) / 86_400_000);
  const semanasRestantes = Math.max(diasRestantes / 7, 1 / 7);
  const falta = Math.max(0, meta - recebidoMes);
  return {
    meta,
    recebido: recebidoMes,
    pct: meta > 0 ? Math.min(100, (recebidoMes / meta) * 100) : 0,
    falta,
    semanasRestantes: Math.round(semanasRestantes * 10) / 10,
    contratosPorSemana: ticketMedio && ticketMedio > 0 && falta > 0 ? Math.ceil(falta / ticketMedio / semanasRestantes) : falta === 0 ? 0 : null,
  };
}

export type FunnelStep = { key: string; label: string; valor: number; conversao: number | null; maiorQueda: boolean };

/**
 * Funil do período: leads salvos → abordados → diagnóstico enviado → proposta enviada → fechados.
 * `reached` = maior etapa alcançada por cada negócio criado no período.
 */
export function funnel(savedLeads: number, reached: Stage[]): FunnelStep[] {
  const idx = (s: Stage) => STAGES.indexOf(s);
  const atLeast = (s: Stage) => reached.filter((r) => r !== "perdido" && idx(r) >= idx(s)).length;
  const steps = [
    { key: "salvos", label: "Leads salvos", valor: Math.max(savedLeads, reached.length) },
    { key: "abordados", label: "Abordados", valor: atLeast("contato") },
    { key: "diagnostico", label: "Diagnóstico enviado", valor: atLeast("exemplo") },
    { key: "proposta", label: "Proposta enviada", valor: atLeast("proposta") },
    { key: "fechados", label: "Fechados", valor: atLeast("ganho") },
  ];
  let worst = -1;
  let worstRate = Infinity;
  const out = steps.map((s, i) => {
    const prev = i ? steps[i - 1].valor : null;
    const conversao = prev ? (s.valor / prev) * 100 : null;
    if (conversao !== null && conversao < worstRate) {
      worstRate = conversao;
      worst = i;
    }
    return { ...s, conversao, maiorQueda: false };
  });
  if (worst > 0 && steps[worst - 1].valor > 0) out[worst].maiorQueda = true;
  return out;
}

/** Frase do cabeçalho gerada dos dados. Nunca inventa: sem dado anterior, fala de follow-ups. */
export function headline(opts: {
  nome: string;
  now: Date;
  receitaMes: number;
  receitaMesAnteriorAteHoje: number;
  followupsAtrasados: number;
  followupsHoje: number;
}): string {
  const g = `${greetingSP(opts.now)}${opts.nome ? `, ${opts.nome.split(" ")[0]}` : ""}.`;
  const p = spParts(opts.now);
  const mes = monthName(p.m);
  const Mes = mes[0].toUpperCase() + mes.slice(1);
  const anterior = monthName(p.m === 1 ? 12 : p.m - 1);
  if (opts.receitaMesAnteriorAteHoje > 0 && opts.receitaMes > 0) {
    const d = pctChange(opts.receitaMes, opts.receitaMesAnteriorAteHoje)!;
    const abs = Math.abs(Math.round(d));
    if (abs === 0) return `${g} ${Mes} está no mesmo ritmo de ${anterior} até agora.`;
    return `${g} ${Mes} está ${abs}% ${d > 0 ? "acima" : "abaixo"} de ${anterior} até agora.`;
  }
  if (opts.followupsAtrasados > 0)
    return `${g} Você tem ${opts.followupsAtrasados} follow-up${opts.followupsAtrasados > 1 ? "s" : ""} atrasado${opts.followupsAtrasados > 1 ? "s" : ""}.`;
  if (opts.followupsHoje > 0) return `${g} Você tem ${opts.followupsHoje} follow-up${opts.followupsHoje > 1 ? "s" : ""} para hoje.`;
  if (opts.receitaMes > 0) return `${g} Primeiros recebimentos de ${mes} registrados.`;
  return `${g} Comece pelo Radar: encontre os primeiros leads da semana.`;
}

export function rangeFromQuery(period: Period, now: Date, from?: string, to?: string): Range {
  if (period === "custom" && from && to) {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    return { from: spDate(fy, fm, fd), to: spDate(ty, tm, td + 1) };
  }
  return periodRange(period === "custom" ? "mes" : period, now);
}

export { previousRange };
