/** Heurísticas puras sobre o HTML do site do lead. */

export function copyrightYear(html: string): number | null {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const re = /(?:©|&copy;|&#169;|copyright)\s*(?:\(c\)\s*)?(?:(\d{4})\s*[-–—]\s*)?(\d{4})/gi;
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const y = Number(m[2]);
    if (y >= 1995 && y <= 2100 && (best === null || y > best)) best = y;
  }
  return best;
}

export function hasWhatsAppButton(html: string): boolean {
  return /(wa\.me\/|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send|whatsapp:\/\/send)/i.test(html);
}

export function instagramHandles(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/instagram\.com\/([A-Za-z0-9_.]{1,30})/gi)) {
    const h = m[1].toLowerCase().replace(/\.$/, "");
    if (!["p", "reel", "reels", "explore", "stories", "accounts", "tv", "sharer", "share"].includes(h)) out.add(`@${h}`);
  }
  return [...out];
}

export type PageSpeedSummary = {
  performance: number | null;
  seo: number | null;
  lcpMs: number | null;
  viewportOk: boolean | null;
  fetchedAt: string | null;
};

type LighthouseJson = {
  lighthouseResult?: {
    fetchTime?: string;
    categories?: { performance?: { score: number | null }; seo?: { score: number | null } };
    audits?: Record<string, { score: number | null; numericValue?: number }>;
  };
};

export function summarizePageSpeed(json: LighthouseJson): PageSpeedSummary {
  const lr = json.lighthouseResult;
  const cat = lr?.categories;
  const toPct = (s: number | null | undefined) => (typeof s === "number" ? Math.round(s * 100) : null);
  const vp = lr?.audits?.viewport?.score;
  return {
    performance: toPct(cat?.performance?.score),
    seo: toPct(cat?.seo?.score),
    lcpMs: lr?.audits?.["largest-contentful-paint"]?.numericValue ?? null,
    viewportOk: typeof vp === "number" ? vp >= 1 : null,
    fetchedAt: lr?.fetchTime ?? null,
  };
}
