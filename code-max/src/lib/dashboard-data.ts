import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  funnel,
  goalProgress,
  headline,
  kpisFor,
  pctChange,
  previousRange,
  rangeFromQuery,
  revenueByNiche,
  revenueSeries,
  type ApproachRow,
  type PaymentRow,
  type WonDealRow,
} from "./dashboard";
import { addDaysSP, periodRange, startOfDaySP, type Period } from "./dates";
import { STAGES, type Stage } from "./pipeline";

export async function loadDashboard(sb: SupabaseClient, opts: { period: Period; from?: string; to?: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const range = rangeFromQuery(opts.period, now, opts.from, opts.to);
  const prev = previousRange(opts.period, range);
  const month = periodRange("mes", now);
  const prevMonth = previousRange("mes", month);
  const since = new Date(Math.min(prev.from.getTime(), prevMonth.from.getTime(), addDaysSP(now, -31).getTime())).toISOString();

  const [profileQ, paymentsQ, wonQ, historyQ, sentQ, subsQ, dealsMonthQ, tasksQ, overdueDealsQ, activityQ, presenceQ, savedQ] = await Promise.all([
    sb.from("profiles").select("nome, meta_mensal, meta_contratos").single(),
    sb.from("payments").select("valor, pago_em, clients(nicho)").gte("pago_em", since),
    sb.from("deals").select("ganho_em, valor_implantacao, mensalidade").eq("etapa", "ganho").gte("ganho_em", since),
    sb.from("deal_stage_history").select("deal_id, para, ocorreu_em, deals(lead_id)").gte("ocorreu_em", since),
    sb.from("interactions").select("lead_id, ocorreu_em").eq("tipo", "mensagem_enviada").gte("ocorreu_em", since),
    sb.from("subscriptions").select("valor").eq("ativa", true),
    sb.from("deals").select("id, etapa").gte("criado_em", month.from.toISOString()),
    sb.from("tasks").select("id, titulo, mensagem, vence_em, lead_id, leads(nome, telefone)").eq("feita", false).lt("vence_em", addDaysSP(startOfDaySP(now), 1).toISOString()).order("vence_em").limit(20),
    sb.from("deals").select("id, etapa, proximo_followup_em, lead_id, leads(nome, telefone)").not("etapa", "in", "(ganho,perdido)").lt("proximo_followup_em", addDaysSP(startOfDaySP(now), 1).toISOString()).order("proximo_followup_em").limit(20),
    sb.from("activity").select("id, tipo, texto, ocorreu_em, lead_id").order("ocorreu_em", { ascending: false }).limit(15),
    sb.from("track_events").select("id, evento, ocorreu_em, lead_id, leads(nome), trackers(tipo)").eq("evento", "open").gte("ocorreu_em", new Date(now.getTime() - 60 * 60_000).toISOString()).order("ocorreu_em", { ascending: false }).limit(10),
    sb.from("leads").select("id", { count: "exact", head: true }).in("status", ["salvo", "cliente"]).gte("criado_em", month.from.toISOString()),
  ]);

  type Rel<T> = T | T[] | null;
  const one = <T,>(r: Rel<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

  const payments: PaymentRow[] = (paymentsQ.data ?? []).map((p) => ({ valor: Number(p.valor), pago_em: p.pago_em, nicho: one(p.clients as Rel<{ nicho: string }>)?.nicho ?? null }));
  const won: WonDealRow[] = (wonQ.data ?? []).map((d) => ({ ganho_em: d.ganho_em, valor_implantacao: Number(d.valor_implantacao), mensalidade: Number(d.mensalidade) }));
  const approaches: ApproachRow[] = [
    ...(historyQ.data ?? []).filter((h) => h.para === "contato").map((h) => ({ lead_id: one(h.deals as Rel<{ lead_id: string }>)?.lead_id ?? h.deal_id, em: h.ocorreu_em })),
    ...(sentQ.data ?? []).map((i) => ({ lead_id: i.lead_id, em: i.ocorreu_em })),
  ];

  const cur = kpisFor(range, payments, won, approaches);
  const old = kpisFor(prev, payments, won, approaches);
  const mrr = (subsQ.data ?? []).reduce((s, x) => s + Number(x.valor), 0);

  // Funil do mês: maior etapa (fora "perdido") que cada negócio criado no mês alcançou.
  const monthDealIds = new Set((dealsMonthQ.data ?? []).map((d) => d.id));
  const maxStage = new Map<string, Stage>();
  for (const d of dealsMonthQ.data ?? []) maxStage.set(d.id, d.etapa === "perdido" ? "novo" : (d.etapa as Stage));
  for (const h of historyQ.data ?? []) {
    if (!monthDealIds.has(h.deal_id) || h.para === "perdido") continue;
    const curStage = maxStage.get(h.deal_id) ?? "novo";
    if (STAGES.indexOf(h.para as Stage) > STAGES.indexOf(curStage)) maxStage.set(h.deal_id, h.para as Stage);
  }

  const mesKpis = kpisFor(month, payments, won, approaches);
  const elapsed = now.getTime() - month.from.getTime();
  const prevSameDay = kpisFor({ from: prevMonth.from, to: new Date(prevMonth.from.getTime() + elapsed) }, payments, won, approaches);
  const meta = Number(profileQ.data?.meta_mensal ?? 0);

  const startToday = startOfDaySP(now).getTime();
  const followups = [
    ...(tasksQ.data ?? []).map((t) => ({ kind: "task" as const, id: t.id, titulo: t.titulo, mensagem: t.mensagem, vence_em: t.vence_em, lead_id: t.lead_id, lead: one(t.leads as Rel<{ nome: string; telefone: string | null }>) })),
    ...(overdueDealsQ.data ?? []).map((d) => ({ kind: "deal" as const, id: d.id, titulo: `Follow-up (${d.etapa})`, mensagem: null, vence_em: d.proximo_followup_em!, lead_id: d.lead_id, lead: one(d.leads as Rel<{ nome: string; telefone: string | null }>) })),
  ]
    .sort((a, b) => a.vence_em.localeCompare(b.vence_em))
    .map((f) => ({ ...f, atrasado: new Date(f.vence_em).getTime() < startToday }));
  const atrasados = followups.filter((f) => f.atrasado).length;

  return {
    now: now.toISOString(),
    period: opts.period,
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    headline: headline({
      nome: profileQ.data?.nome ?? "",
      now,
      receitaMes: mesKpis.faturamento,
      receitaMesAnteriorAteHoje: prevSameDay.faturamento,
      followupsAtrasados: atrasados,
      followupsHoje: followups.length - atrasados,
    }),
    kpis: {
      faturamento: { valor: cur.faturamento, delta: pctChange(cur.faturamento, old.faturamento) },
      contratos: { valor: cur.contratos, delta: pctChange(cur.contratos, old.contratos) },
      ticketMedio: { valor: cur.ticketMedio, delta: cur.ticketMedio !== null && old.ticketMedio !== null ? pctChange(cur.ticketMedio, old.ticketMedio) : null },
      conversao: { valor: cur.conversao, delta: cur.conversao !== null && old.conversao !== null ? cur.conversao - old.conversao : null },
      mrr: { valor: mrr, delta: null as number | null },
    },
    series: revenueSeries(opts.period, range, prev, payments, now),
    porNicho: revenueByNiche(payments, range),
    meta: goalProgress(meta, mesKpis.faturamento, mesKpis.ticketMedio, now),
    metaContratos: { meta: Number(profileQ.data?.meta_contratos ?? 0), feitos: mesKpis.contratos },
    funil: funnel(savedQ.count ?? 0, [...maxStage.values()]),
    followups,
    atrasados,
    activity: activityQ.data ?? [],
    presence: (presenceQ.data ?? []).map((e) => ({
      id: e.id,
      ocorreu_em: e.ocorreu_em,
      lead_id: e.lead_id,
      nome: one(e.leads as Rel<{ nome: string }>)?.nome ?? "Lead",
      tipo: one(e.trackers as Rel<{ tipo: string }>)?.tipo ?? "exemplo",
    })),
    temDados: payments.length > 0 || won.length > 0 || (historyQ.data?.length ?? 0) > 0,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
