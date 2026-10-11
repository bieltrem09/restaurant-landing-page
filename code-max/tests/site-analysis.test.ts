import { describe, expect, it } from "vitest";
import { copyrightYear, hasWhatsAppButton, instagramHandles, summarizePageSpeed } from "@/lib/site-analysis";

describe("análise de HTML", () => {
  it("ano de copyright (pega o maior, ignora scripts)", () => {
    expect(copyrightYear("<footer>© 2015-2018 Clínica</footer>")).toBe(2018);
    expect(copyrightYear("<p>Copyright 2024</p><script>var a='© 2099'</script>")).toBe(2024);
    expect(copyrightYear("<p>&copy; 2019</p>")).toBe(2019);
    expect(copyrightYear("<p>sem nada</p>")).toBeNull();
  });
  it("botão de WhatsApp e Instagram", () => {
    expect(hasWhatsAppButton('<a href="https://wa.me/5511">')).toBe(true);
    expect(hasWhatsAppButton("<a>contato</a>")).toBe(false);
    expect(instagramHandles('<a href="https://www.instagram.com/clinica.x/">ig</a><a href="https://instagram.com/p/123">')).toEqual(["@clinica.x"]);
  });
  it("resume PageSpeed", () => {
    const s = summarizePageSpeed({
      lighthouseResult: {
        fetchTime: "2026-10-10T00:00:00Z",
        categories: { performance: { score: 0.42 }, seo: { score: 0.9 } },
        audits: { viewport: { score: 0 }, "largest-contentful-paint": { score: 0.1, numericValue: 5200 } },
      },
    });
    expect(s).toEqual({ performance: 42, seo: 90, lcpMs: 5200, viewportOk: false, fetchedAt: "2026-10-10T00:00:00Z" });
  });
});
