import { NICHE_BY_KEY } from "./niches";

/** Chaves dos pesos editáveis em Ajustes. */
export const DEFAULT_WEIGHTS = {
  sem_site: 40,
  so_rede_social: 34,
  marketplace: 20,
  site_fora_do_ar: 30,
  pagespeed_lt50: 14,
  pagespeed_50_69: 7,
  nao_responsivo: 12,
  sem_https: 8,
  copyright_antigo: 6,
  sem_whatsapp: 5,
  nota_45: 12,
  nota_40_44: 6,
  avaliacoes_150: 8,
  avaliacoes_50_149: 4,
  instagram: 6,
  ticket_alto: 10,
  ticket_medio: 5,
} as const;

export type WeightKey = keyof typeof DEFAULT_WEIGHTS;
export type Weights = Record<WeightKey, number>;

export const WEIGHT_LABELS: Record<WeightKey, string> = {
  sem_site: "Sem site",
  so_rede_social: "Só rede social como site",
  marketplace: "Depende de marketplace (restaurante)",
  site_fora_do_ar: "Site fora do ar ou com erro",
  pagespeed_lt50: "PageSpeed mobile < 50",
  pagespeed_50_69: "PageSpeed mobile 50 a 69",
  nao_responsivo: "Não responsivo (viewport falhou)",
  sem_https: "Sem HTTPS",
  copyright_antigo: "Copyright ≤ 2019",
  sem_whatsapp: "Sem botão de WhatsApp no site",
  nota_45: "Nota Google ≥ 4,5",
  nota_40_44: "Nota Google 4,0 a 4,4",
  avaliacoes_150: "Avaliações ≥ 150",
  avaliacoes_50_149: "Avaliações 50 a 149",
  instagram: "Instagram encontrado",
  ticket_alto: "Nicho de ticket alto",
  ticket_medio: "Nicho de ticket médio",
};

/** Sinais em `kind: "oportunidade"` são chips vermelhos; `"forca"` são verdes. */
export const WEIGHT_KIND: Record<WeightKey, "oportunidade" | "forca"> = {
  sem_site: "oportunidade",
  so_rede_social: "oportunidade",
  marketplace: "oportunidade",
  site_fora_do_ar: "oportunidade",
  pagespeed_lt50: "oportunidade",
  pagespeed_50_69: "oportunidade",
  nao_responsivo: "oportunidade",
  sem_https: "oportunidade",
  copyright_antigo: "oportunidade",
  sem_whatsapp: "oportunidade",
  nota_45: "forca",
  nota_40_44: "forca",
  avaliacoes_150: "forca",
  avaliacoes_50_149: "forca",
  instagram: "forca",
  ticket_alto: "forca",
  ticket_medio: "forca",
};

export function mergeWeights(custom?: Partial<Weights> | null): Weights {
  const out = { ...DEFAULT_WEIGHTS } as Weights;
  if (!custom) return out;
  for (const k of Object.keys(DEFAULT_WEIGHTS) as WeightKey[]) {
    const v = custom[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Fatos coletados sobre um lead. `null`/`undefined` = não verificado:
 * nunca vira ponto, e a interface mostra "não verificado".
 */
export type LeadFacts = {
  nicho: string;
  rating?: number | null;
  ratingCount?: number | null;
  /** Classificação do websiteUri. */
  site?: "nenhum" | "rede_social" | "marketplace" | "proprio" | null;
  siteOnline?: boolean | null;
  pagespeedPerformance?: number | null;
  viewportOk?: boolean | null;
  https?: boolean | null;
  copyrightYear?: number | null;
  whatsappButton?: boolean | null;
  instagram?: string | null;
};

export type ScorePart = { key: WeightKey; label: string; pontos: number; kind: "oportunidade" | "forca" };

export type ScoreResult = { score: number; faixa: "quente" | "morno" | "frio"; parts: ScorePart[]; bruto: number };

/**
 * Pontuação máxima "realista" usada para normalizar: o melhor cenário de oportunidade
 * (sem site, 40) somado a todos os sinais de força possíveis. Assim um lead sem site,
 * nota 4,5+, 150+ avaliações e de ticket alto chega a 100.
 */
export function maxPoints(w: Weights): number {
  const oportunidade = Math.max(w.sem_site, w.so_rede_social + w.marketplace, w.site_fora_do_ar,
    w.pagespeed_lt50 + w.nao_responsivo + w.sem_https + w.copyright_antigo + w.sem_whatsapp);
  const forca = w.nota_45 + w.avaliacoes_150 + w.ticket_alto;
  return Math.max(1, oportunidade + forca);
}

export function faixaFor(score: number): ScoreResult["faixa"] {
  if (score >= 80) return "quente";
  if (score >= 60) return "morno";
  return "frio";
}

export function computeScore(f: LeadFacts, weights?: Partial<Weights> | null): ScoreResult {
  const w = mergeWeights(weights);
  const parts: ScorePart[] = [];
  const add = (key: WeightKey) => {
    if (w[key] !== 0) parts.push({ key, label: WEIGHT_LABELS[key], pontos: w[key], kind: WEIGHT_KIND[key] });
  };
  const niche = NICHE_BY_KEY[f.nicho];

  if (f.site === "nenhum") add("sem_site");
  else if (f.site === "rede_social") add("so_rede_social");
  else if (f.site === "marketplace") {
    // Link de cardápio/marketplace como "site": para restaurante é o sinal próprio;
    // para outros nichos equivale a não ter site próprio.
    if (niche?.restaurante) {
      add("so_rede_social");
      add("marketplace");
    } else add("so_rede_social");
  } else if (f.site === "proprio") {
    if (f.siteOnline === false) add("site_fora_do_ar");
    else {
      if (typeof f.pagespeedPerformance === "number") {
        if (f.pagespeedPerformance < 50) add("pagespeed_lt50");
        else if (f.pagespeedPerformance < 70) add("pagespeed_50_69");
      }
      if (f.viewportOk === false) add("nao_responsivo");
      if (f.https === false) add("sem_https");
      if (typeof f.copyrightYear === "number" && f.copyrightYear <= 2019) add("copyright_antigo");
      if (f.whatsappButton === false) add("sem_whatsapp");
    }
  }

  if (typeof f.rating === "number") {
    if (f.rating >= 4.5) add("nota_45");
    else if (f.rating >= 4.0) add("nota_40_44");
  }
  if (typeof f.ratingCount === "number") {
    if (f.ratingCount >= 150) add("avaliacoes_150");
    else if (f.ratingCount >= 50) add("avaliacoes_50_149");
  }
  if (f.instagram) add("instagram");
  if (niche?.ticket === "alto") add("ticket_alto");
  else if (niche?.ticket === "medio") add("ticket_medio");

  const bruto = parts.reduce((s, p) => s + p.pontos, 0);
  const score = Math.max(0, Math.min(100, Math.round((bruto / maxPoints(w)) * 100)));
  return { score, faixa: faixaFor(score), parts, bruto };
}

const SOCIAL_HOSTS = ["instagram.com", "facebook.com", "fb.com", "linktr.ee", "wa.me", "api.whatsapp.com", "tiktok.com", "linkin.bio", "beacons.ai"];
const MARKETPLACE_HOSTS = ["ifood.com.br", "goomer.app", "goomer.com.br", "anota.ai", "anotaai.com", "aiqfome.com", "rappi.com.br", "deliverydireto.com.br", "menudino.com", "cardapioweb.com", "ola.click", "cardapio.ai", "neemo.com.br", "saipos.com", "pedir.delivery"];

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

export function classifyWebsite(uri: string | null | undefined): NonNullable<LeadFacts["site"]> {
  if (!uri || !uri.trim()) return "nenhum";
  let host: string;
  try {
    host = new URL(uri.startsWith("http") ? uri : `https://${uri}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "nenhum";
  }
  if (hostMatches(host, SOCIAL_HOSTS)) return "rede_social";
  if (hostMatches(host, MARKETPLACE_HOSTS)) return "marketplace";
  return "proprio";
}

export function instagramHandleFromUrl(uri: string): string | null {
  const m = uri.match(/instagram\.com\/([A-Za-z0-9_.]{1,30})/i);
  if (!m) return null;
  const h = m[1].toLowerCase();
  if (["p", "reel", "reels", "explore", "stories", "accounts", "tv"].includes(h)) return null;
  return `@${h}`;
}
