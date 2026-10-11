import { describe, expect, it } from "vitest";
import { buckets, funnel, goalProgress, headline, kpisFor, pctChange, revenueByNiche, revenueSeries } from "@/lib/dashboard";
import { dayKeySP, periodRange, previousRange, spDate } from "@/lib/dates";

// 11/10/2026 15:00 em São Paulo (= 18:00 UTC), domingo.
const NOW = new Date("2026-10-11T18:00:00Z");

describe("períodos em America/Sao_Paulo", () => {
  it("dia começa à meia-noite de São Paulo (03:00 UTC)", () => {
    const r = periodRange("dia", NOW);
    expect(r.from.toISOString()).toBe("2026-10-11T03:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-12T03:00:00.000Z");
  });

  it("pagamento às 23:30 de SP conta no dia de SP, não no dia UTC", () => {
    const pago = "2026-10-11T02:30:00Z"; // 10/10 23:30 em SP
    expect(dayKeySP(new Date(pago))).toBe("2026-10-10");
    const k = kpisFor(periodRange("dia", NOW), [{ valor: 100, pago_em: pago }], [], []);
    expect(k.faturamento).toBe(0);
  });

  it("semana começa na segunda", () => {
    const r = periodRange("semana", NOW);
    expect(r.from.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-12T03:00:00.000Z");
  });

  it("mês e período anterior", () => {
    const r = periodRange("mes", NOW);
    expect(r.from.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    const p = previousRange("mes", r);
    expect(p.from.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(p.to.toISOString()).toBe(r.from.toISOString());
  });

  it("ano tem 12 barras e mês de outubro tem 31", () => {
    expect(buckets("ano", periodRange("ano", NOW))).toHaveLength(12);
    expect(buckets("mes", periodRange("mes", NOW))).toHaveLength(31);
    expect(buckets("semana", periodRange("semana", NOW)).map((b) => b.label)).toEqual(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]);
    expect(buckets("dia", periodRange("dia", NOW))).toHaveLength(12);
  });
});

describe("KPIs", () => {
  const payments = [
    { valor: 1500, pago_em: "2026-10-02T15:00:00Z", nicho: "dentista" },
    { valor: 100, pago_em: "2026-10-05T15:00:00Z", nicho: "pizzaria" },
    { valor: 900, pago_em: "2026-09-10T15:00:00Z", nicho: "dentista" },
  ];
  const won = [
    { ganho_em: "2026-10-02T14:00:00Z", valor_implantacao: 1500, mensalidade: 150 },
    { ganho_em: "2026-10-05T14:00:00Z", valor_implantacao: 0, mensalidade: 100 },
  ];
  const approaches = [
    { lead_id: "a", em: "2026-10-01T12:00:00Z" },
    { lead_id: "a", em: "2026-10-03T12:00:00Z" },
    { lead_id: "b", em: "2026-10-04T12:00:00Z" },
    { lead_id: "c", em: "2026-10-04T12:00:00Z" },
    { lead_id: "d", em: "2026-10-04T12:00:00Z" },
  ];

  it("faturamento soma pagamentos; contratos, ticket e conversão vêm dos negócios", () => {
    const k = kpisFor(periodRange("mes", NOW), payments, won, approaches);
    expect(k.faturamento).toBe(1600);
    expect(k.contratos).toBe(2);
    expect(k.ticketMedio).toBe((1650 + 100) / 2);
    expect(k.abordados).toBe(4);
    expect(k.conversao).toBe(50);
  });

  it("sem dados não inventa números", () => {
    const k = kpisFor(periodRange("mes", NOW), [], [], []);
    expect(k).toEqual({ faturamento: 0, contratos: 0, ticketMedio: null, conversao: null, abordados: 0 });
  });

  it("variação percentual", () => {
    expect(pctChange(118, 100)).toBeCloseTo(18);
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(10, 0)).toBeNull();
  });

  it("série do mês marca hoje, futuro com projeção e anterior alinhado", () => {
    const r = periodRange("mes", NOW);
    const s = revenueSeries("mes", r, previousRange("mes", r), payments, NOW);
    expect(s[1].atual).toBe(1500);
    expect(s[1].pagamentos).toBe(1);
    expect(s[10].agora).toBe(true);
    expect(s[11].futuro).toBe(true);
    expect(s[11].atual).toBeNull();
    // média móvel dos últimos 30 dias (11/09 a 11/10): (1500 + 100)/30 por dia
    expect(s[11].projecao).toBeCloseTo(1600 / 30, 1);
    expect(s[9].anterior).toBe(900);
  });

  it("receita por nicho", () => {
    expect(revenueByNiche(payments, periodRange("mes", NOW))).toEqual([
      { nicho: "dentista", valor: 1500 },
      { nicho: "pizzaria", valor: 100 },
    ]);
  });
});

describe("meta, funil e frase", () => {
  it("meta calcula quanto falta e contratos por semana", () => {
    const g = goalProgress(10000, 4000, 1500, NOW);
    expect(g.falta).toBe(6000);
    expect(g.pct).toBe(40);
    expect(g.contratosPorSemana).toBeGreaterThan(0);
  });

  it("funil destaca a maior queda", () => {
    const f = funnel(10, ["contato", "contato", "exemplo", "proposta", "ganho", "novo", "perdido"]);
    expect(f.map((s) => s.valor)).toEqual([10, 5, 3, 2, 1]);
    expect(f.find((s) => s.maiorQueda)?.key).toBe("abordados");
  });

  it("frase compara com o mês anterior ou fala de follow-ups", () => {
    expect(headline({ nome: "Vinicius Souza", now: NOW, receitaMes: 1180, receitaMesAnteriorAteHoje: 1000, followupsAtrasados: 0, followupsHoje: 0 })).toBe(
      "Boa tarde, Vinicius. Outubro está 18% acima de setembro até agora.",
    );
    expect(headline({ nome: "Vinicius", now: NOW, receitaMes: 0, receitaMesAnteriorAteHoje: 0, followupsAtrasados: 3, followupsHoje: 0 })).toBe(
      "Boa tarde, Vinicius. Você tem 3 follow-ups atrasados.",
    );
  });

  it("spDate respeita meia-noite de SP", () => {
    expect(spDate(2026, 1, 1).toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });
});
