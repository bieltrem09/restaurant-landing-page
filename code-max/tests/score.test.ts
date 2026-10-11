import { describe, expect, it } from "vitest";
import { classifyWebsite, computeScore, DEFAULT_WEIGHTS, faixaFor, instagramHandleFromUrl } from "@/lib/score";

describe("classifyWebsite", () => {
  it("classifica sem site, rede social, marketplace e próprio", () => {
    expect(classifyWebsite(null)).toBe("nenhum");
    expect(classifyWebsite("")).toBe("nenhum");
    expect(classifyWebsite("https://www.instagram.com/pizzaria")).toBe("rede_social");
    expect(classifyWebsite("https://linktr.ee/x")).toBe("rede_social");
    expect(classifyWebsite("https://wa.me/5511999999999")).toBe("rede_social");
    expect(classifyWebsite("https://www.ifood.com.br/delivery/sp/x")).toBe("marketplace");
    expect(classifyWebsite("https://pizzaria.goomer.app")).toBe("marketplace");
    expect(classifyWebsite("https://clinicasorriso.com.br")).toBe("proprio");
    expect(classifyWebsite("clinicasorriso.com.br")).toBe("proprio");
  });
});

describe("computeScore", () => {
  it("lead sem site, nota 4,7, 200 avaliações e ticket alto é quente", () => {
    const r = computeScore({ nicho: "dentista", site: "nenhum", rating: 4.7, ratingCount: 200 });
    expect(r.parts.map((p) => p.key)).toEqual(["sem_site", "nota_45", "avaliacoes_150", "ticket_alto"]);
    expect(r.faixa).toBe("quente");
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("dado não verificado não vira ponto", () => {
    const r = computeScore({ nicho: "pizzaria", site: "proprio", siteOnline: true, rating: null, ratingCount: null, pagespeedPerformance: null, viewportOk: null, https: null });
    expect(r.parts).toEqual([]);
    expect(r.score).toBe(0);
  });

  it("site próprio fraco soma PageSpeed, viewport, https, copyright e WhatsApp", () => {
    const r = computeScore({ nicho: "advogado", site: "proprio", siteOnline: true, pagespeedPerformance: 31, viewportOk: false, https: false, copyrightYear: 2018, whatsappButton: false });
    expect(r.parts.map((p) => p.key)).toEqual(["pagespeed_lt50", "nao_responsivo", "sem_https", "copyright_antigo", "sem_whatsapp", "ticket_alto"]);
    expect(r.bruto).toBe(14 + 12 + 8 + 6 + 5 + 10);
  });

  it("PageSpeed 50-69 vale menos que < 50; 70+ não pontua", () => {
    expect(computeScore({ nicho: "x", site: "proprio", pagespeedPerformance: 60 }).parts[0].key).toBe("pagespeed_50_69");
    expect(computeScore({ nicho: "x", site: "proprio", pagespeedPerformance: 70 }).parts).toEqual([]);
  });

  it("site fora do ar ignora métricas de qualidade", () => {
    const r = computeScore({ nicho: "x", site: "proprio", siteOnline: false, pagespeedPerformance: 10 });
    expect(r.parts.map((p) => p.key)).toEqual(["site_fora_do_ar"]);
  });

  it("restaurante que depende de marketplace recebe o sinal próprio", () => {
    const r = computeScore({ nicho: "pizzaria", site: "marketplace" });
    expect(r.parts.map((p) => p.key)).toContain("marketplace");
    const outro = computeScore({ nicho: "dentista", site: "marketplace" });
    expect(outro.parts.map((p) => p.key)).not.toContain("marketplace");
  });

  it("respeita pesos customizados", () => {
    const a = computeScore({ nicho: "x", site: "nenhum" });
    const b = computeScore({ nicho: "x", site: "nenhum" }, { sem_site: 0 });
    expect(a.parts).toHaveLength(1);
    expect(b.parts).toHaveLength(0);
  });

  it("score fica entre 0 e 100", () => {
    const alto = computeScore({ nicho: "advogado", site: "nenhum", rating: 5, ratingCount: 999, instagram: "@x" }, { ...DEFAULT_WEIGHTS, instagram: 500 });
    expect(alto.score).toBe(100);
    const negativo = computeScore({ nicho: "x", site: "nenhum" }, { sem_site: -50 });
    expect(negativo.score).toBe(0);
  });

  it("faixas", () => {
    expect(faixaFor(80)).toBe("quente");
    expect(faixaFor(79)).toBe("morno");
    expect(faixaFor(60)).toBe("morno");
    expect(faixaFor(59)).toBe("frio");
  });

  it("extrai @ do Instagram", () => {
    expect(instagramHandleFromUrl("https://instagram.com/Cheff.Gourmett/")).toBe("@cheff.gourmett");
    expect(instagramHandleFromUrl("https://instagram.com/p/abc")).toBeNull();
  });
});
