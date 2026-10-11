import { describe, expect, it } from "vitest";
import { followupDueAt, nextStage, pipelineTotals } from "@/lib/pipeline";

describe("pipeline", () => {
  it("avança etapas até ganho", () => {
    expect(nextStage("novo")).toBe("contato");
    expect(nextStage("negociacao")).toBe("ganho");
    expect(nextStage("ganho")).toBeNull();
    expect(nextStage("perdido")).toBeNull();
  });
  it("prazo de follow-up por etapa", () => {
    const t = new Date("2026-10-10T12:00:00Z");
    expect(followupDueAt("exemplo", t)?.toISOString()).toBe("2026-10-11T12:00:00.000Z");
    expect(followupDueAt("contato", t)?.toISOString()).toBe("2026-10-12T12:00:00.000Z");
    expect(followupDueAt("novo", t)).toBeNull();
  });
  it("totais: aberto, ponderado, ganhos do mês e ciclo médio real", () => {
    const now = new Date("2026-10-11T18:00:00Z");
    const t = pipelineTotals(
      [
        { etapa: "proposta", valor_implantacao: 1000, mensalidade: 0, criado_em: "2026-10-01T00:00:00Z" },
        { etapa: "ganho", valor_implantacao: 500, mensalidade: 100, criado_em: "2026-10-01T00:00:00Z", ganho_em: "2026-10-11T00:00:00Z" },
        { etapa: "perdido", valor_implantacao: 9999, mensalidade: 0, criado_em: "2026-10-01T00:00:00Z" },
      ],
      now,
      new Date("2026-10-01T03:00:00Z"),
    );
    expect(t.emAberto).toBe(1000);
    expect(t.ponderada).toBe(500);
    expect(t.ganhosMes).toBe(500 + 1200);
    expect(t.cicloMedioDias).toBe(10);
  });
});
