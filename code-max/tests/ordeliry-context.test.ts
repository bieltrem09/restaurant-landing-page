import { describe, expect, it } from "vitest";
import { buildSystemPrompt, formatCatalog } from "@/lib/ordeliry/context";
import type { Lead, Service } from "@/lib/types";

const profile = { nome: "Vinicius", estudio: "Studio V", tom: "equilibrado" as const, whatsapp: "", horario_comercial: { inicio: "09:00", fim: "18:00", dias: [1, 2, 3, 4, 5] } };
const service: Service = {
  id: "s1", nome: "Cardápio digital com QR code", nichos: ["pizzaria"], descricao: "", inclui: ["manutenção"], nao_inclui: ["fotos"],
  preco_implantacao: 0, mensalidade: 100, prazo_dias: 3, ativo: true,
};
const lead = {
  id: "l1", nome: "Pizzaria Teste", nicho: "pizzaria", rating: 4.7, rating_count: 210, website: null, score: 82, faixa: "quente",
  signals: [{ id: "x", lead_id: "l1", chave: "sem_site", valor_json: { websiteUri: null }, pontos: 40, fonte: "google_places", coletado_em: "2026-10-10T12:00:00Z" }],
  pacote: service,
} as unknown as Lead & { signals: never[]; pacote: Service };

describe("contexto da Ordeliry", () => {
  const now = new Date("2026-10-11T18:00:00Z");

  it("preenche todas as variáveis do prompt literal", () => {
    const s = buildSystemPrompt({ profile, services: [service], portfolio: [], lead, interactions: [], deal: { etapa: "contato", entrou_na_etapa_em: "2026-10-09T18:00:00Z" }, playbook: [], now });
    expect(s).not.toMatch(/\{\{[a-z_.]+\}\}/);
    expect(s).toContain("Você é a Ordeliry");
    expect(s).toContain("ao lado de Vinicius, do estúdio Studio V");
    expect(s).toMatch(/Mensalidade: R\$\s100,00/);
    expect(s).toContain("Nota no Google: 4.7 (210 avaliações)");
    expect(s).toContain("fonte google_places");
    expect(s).toContain("Etapa do pipeline: Contato feito  · Dias na etapa: 2");
  });

  it("catálogo vazio instrui a não chutar preço", () => {
    expect(formatCatalog([])).toMatch(/VAZIO/);
    expect(formatCatalog([{ ...service, ativo: false }])).toMatch(/VAZIO/);
  });

  it("inclui só playbook aprovado e exemplos de ganhos", () => {
    const s = buildSystemPrompt({
      profile, services: [], portfolio: [], playbook: [
        { id: "1", titulo: "Aprovado", nicho: null, conteudo: "lição A", fonte: "manual", aprovado: true },
        { id: "2", titulo: "Rascunho", nicho: null, conteudo: "lição B", fonte: "manual", aprovado: false },
      ], wins: [{ nicho: "pizzaria", conversa: "conversa ganha" }], now,
    });
    expect(s).toContain("lição A");
    expect(s).not.toContain("lição B");
    expect(s).toContain("conversa ganha");
  });
});
