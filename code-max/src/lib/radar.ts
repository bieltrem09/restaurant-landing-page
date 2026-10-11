import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NICHE_BY_KEY } from "./niches";
import { classifyWebsite, computeScore, instagramHandleFromUrl, WEIGHT_SIGNAL, type LeadFacts, type WeightKey } from "./score";
import { copyrightYear, hasWhatsAppButton, instagramHandles, summarizePageSpeed, type PageSpeedSummary } from "./site-analysis";
import type { Lead, Service } from "./types";

export const PLACES_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.primaryType",
  "places.addressComponents",
];

export type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  primaryType?: string;
  addressComponents?: Array<{ longText: string; types: string[] }>;
};

const CACHE_DAYS = 30;
const MAX_PAGES = 3; // 20 por página → até 60 resultados

// ---------------------------------------------------------------- uso e limite
export async function placesUsageThisMonth(sb: SupabaseClient, userId: string, now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data } = await sb.from("api_usage").select("chamadas").eq("user_id", userId).eq("api", "places").gte("ocorreu_em", start);
  return (data ?? []).reduce((s, r) => s + (r.chamadas as number), 0);
}

export async function recordUsage(sb: SupabaseClient, userId: string, api: "places" | "pagespeed" | "anthropic", chamadas: number) {
  if (chamadas > 0) await sb.from("api_usage").insert({ user_id: userId, api, chamadas });
}

/** Estimativa de chamadas: 1 para localizar o centro (se não veio ponto no mapa) + até 3 páginas de Text Search. */
export function estimateCalls(opts: { hasPoint: boolean; cachedQuery: boolean }): { min: number; max: number } {
  if (opts.cachedQuery) return { min: 0, max: 0 };
  const geo = opts.hasPoint ? 0 : 1;
  return { min: geo + 1, max: geo + MAX_PAGES };
}

// ---------------------------------------------------------------- cache
async function cacheGet<T>(admin: SupabaseClient, key: string): Promise<T | null> {
  const { data } = await admin.from("places_cache").select("payload_json, coletado_em").eq("place_id", key).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.coletado_em).getTime() > CACHE_DAYS * 86_400_000) return null;
  return data.payload_json as T;
}

async function cachePut(admin: SupabaseClient, key: string, payload: unknown) {
  await admin.from("places_cache").upsert({ place_id: key, payload_json: payload, coletado_em: new Date().toISOString() });
}

export function queryCacheKey(q: { nicho: string; cidade: string; bairro?: string | null; lat?: number | null; lng?: number | null; raioKm: number }) {
  const loc = q.lat != null && q.lng != null ? `${q.lat.toFixed(3)},${q.lng.toFixed(3)}` : `${q.bairro ?? ""}|${q.cidade}`.toLowerCase();
  return `q:${q.nicho}|${loc}|${q.raioKm}`;
}

// ---------------------------------------------------------------- Google Places (New)
async function placesSearch(body: Record<string, unknown>, fieldMask: string): Promise<{ places?: Place[]; nextPageToken?: string }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY não configurada no servidor.");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify({ languageCode: "pt-BR", regionCode: "BR", ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Places respondeu ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

/** Localiza o centro da busca (bairro + cidade) com uma chamada de Text Search. */
export async function geocodeArea(cidade: string, bairro?: string | null): Promise<{ lat: number; lng: number } | null> {
  const r = await placesSearch({ textQuery: [bairro, cidade, "Brasil"].filter(Boolean).join(", "), pageSize: 1 }, "places.location");
  const loc = r.places?.[0]?.location;
  return loc ? { lat: loc.latitude, lng: loc.longitude } : null;
}

export async function textSearchAll(opts: { query: string; includedType?: string; lat: number; lng: number; raioKm: number }): Promise<{ places: Place[]; calls: number }> {
  const out: Place[] = [];
  let token: string | undefined;
  let calls = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      textQuery: opts.query,
      pageSize: 20,
      locationBias: { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: Math.min(50_000, opts.raioKm * 1000) } },
    };
    if (token) body.pageToken = token;
    const r = await placesSearch(body, [...PLACES_FIELDS, "nextPageToken"].join(","));
    calls++;
    out.push(...(r.places ?? []));
    token = r.nextPageToken;
    if (!token) break;
  }
  return { places: out, calls };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function component(p: Place, type: string): string | null {
  return p.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null;
}

export function placeToLead(p: Place, nicho: string, center: { lat: number; lng: number }) {
  const lat = p.location?.latitude ?? null;
  const lng = p.location?.longitude ?? null;
  return {
    place_id: p.id,
    nome: p.displayName?.text ?? "(sem nome)",
    nicho,
    endereco: p.formattedAddress ?? null,
    bairro: component(p, "sublocality_level_1") ?? component(p, "sublocality") ?? null,
    cidade: component(p, "administrative_area_level_2") ?? component(p, "locality") ?? null,
    lat,
    lng,
    distancia_km: lat != null && lng != null ? Math.round(haversineKm(center, { lat, lng }) * 100) / 100 : null,
    telefone: p.nationalPhoneNumber ?? null,
    telefone_internacional: p.internationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    instagram: p.websiteUri ? instagramHandleFromUrl(p.websiteUri) : null,
    rating: p.rating ?? null,
    rating_count: p.userRatingCount ?? null,
    maps_url: p.googleMapsUri ?? null,
    primary_type: p.primaryType ?? null,
  };
}

// ---------------------------------------------------------------- enriquecimento do site
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(u.protocol) || PRIVATE_HOST.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

async function readLimited(res: Response, maxBytes = 1_500_000): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export type SiteCheck = {
  online: boolean;
  status: number | null;
  https: boolean | null;
  finalUrl: string | null;
  html: string | null;
  erro: string | null;
};

/** HEAD com timeout de 8s (cai para GET se o servidor não aceitar HEAD) e leitura do HTML. */
export async function checkSite(raw: string): Promise<SiteCheck> {
  const u = safeUrl(raw);
  if (!u) return { online: false, status: null, https: null, finalUrl: null, html: null, erro: "URL inválida" };
  const httpsUrl = new URL(u.toString());
  httpsUrl.protocol = "https:";
  const ua = { "User-Agent": "Mozilla/5.0 (compatible; CodeMaxBot/1.0; +diagnostico de presenca digital)" };
  let https: boolean | null = null;
  try {
    const head = await fetch(httpsUrl, { method: "HEAD", redirect: "follow", headers: ua, signal: AbortSignal.timeout(8000) });
    https = head.url.startsWith("https:");
  } catch {
    https = false;
  }
  try {
    const res = await fetch(https ? httpsUrl : u, { redirect: "follow", headers: ua, signal: AbortSignal.timeout(8000) });
    const html = res.ok ? await readLimited(res) : null;
    return { online: res.ok, status: res.status, https: https && res.url.startsWith("https:"), finalUrl: res.url, html, erro: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { online: false, status: null, https, finalUrl: null, html: null, erro: e instanceof Error ? e.name : "erro" };
  }
}

export async function runPageSpeed(url: string): Promise<PageSpeedSummary | null> {
  const params = new URLSearchParams({ url, strategy: "mobile" });
  params.append("category", "performance");
  params.append("category", "seo");
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: AbortSignal.timeout(55_000) });
    if (!res.ok) return null;
    return summarizePageSpeed(await res.json());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- sinais e score

type SignalRow = { chave: string; valor_json: unknown; fonte: string; coletado_em: string };

export function suggestPackage(services: Service[], nicho: string): Service | null {
  const active = services.filter((s) => s.ativo);
  return active.find((s) => s.nichos.includes(nicho)) ?? active.find((s) => s.nichos.length === 0) ?? null;
}

/**
 * Enriquece um lead: coleta os sinais, salva cada um com fonte e data, recalcula score e pacote.
 * Funciona com o cliente do usuário (RLS) ou com o service role (cron).
 */
export async function enrichLead(
  sb: SupabaseClient,
  lead: Lead & { user_id: string },
  opts: { weights: Partial<Record<WeightKey, number>> | null; services: Service[]; skipPageSpeed?: boolean },
): Promise<{ score: number; faixa: string; pagespeedCalls: number; siteMudou: boolean }> {
  const now = new Date().toISOString();
  const signals: SignalRow[] = [];
  const site = classifyWebsite(lead.website);
  const facts: LeadFacts = { nicho: lead.nicho, rating: lead.rating, ratingCount: lead.rating_count, site, instagram: lead.instagram };
  let pagespeedCalls = 0;

  signals.push({ chave: "website", valor_json: { websiteUri: lead.website, classificacao: site }, fonte: "google_places", coletado_em: lead.ultima_coleta ?? now });
  signals.push({ chave: "rating", valor_json: lead.rating, fonte: "google_places", coletado_em: lead.ultima_coleta ?? now });
  signals.push({ chave: "rating_count", valor_json: lead.rating_count, fonte: "google_places", coletado_em: lead.ultima_coleta ?? now });
  signals.push({ chave: "nicho", valor_json: { nicho: lead.nicho, ticket: NICHE_BY_KEY[lead.nicho]?.ticket ?? null }, fonte: "configuracao", coletado_em: now });

  if (site === "proprio" && lead.website) {
    const check = await checkSite(lead.website);
    facts.siteOnline = check.online;
    signals.push({ chave: "site_online", valor_json: { online: check.online, status: check.status, erro: check.erro, url: check.finalUrl }, fonte: "requisicao_http", coletado_em: now });
    if (check.online) {
      facts.https = check.https;
      signals.push({ chave: "https", valor_json: check.https, fonte: "requisicao_http", coletado_em: now });
      if (check.html) {
        facts.copyrightYear = copyrightYear(check.html);
        facts.whatsappButton = hasWhatsAppButton(check.html);
        const ig = instagramHandles(check.html)[0] ?? null;
        if (ig) facts.instagram = ig;
        signals.push({ chave: "copyright", valor_json: facts.copyrightYear, fonte: "html_do_site", coletado_em: now });
        signals.push({ chave: "whatsapp_button", valor_json: facts.whatsappButton, fonte: "html_do_site", coletado_em: now });
        signals.push({ chave: "instagram", valor_json: facts.instagram ?? null, fonte: ig ? "html_do_site" : "google_places", coletado_em: now });
      }
      if (!opts.skipPageSpeed) {
        const ps = await runPageSpeed(check.finalUrl ?? lead.website);
        pagespeedCalls = 1;
        facts.pagespeedPerformance = ps?.performance ?? null;
        facts.viewportOk = ps?.viewportOk ?? null;
        signals.push({ chave: "pagespeed", valor_json: ps ? { performance: ps.performance, seo: ps.seo, lcpMs: ps.lcpMs } : null, fonte: "pagespeed_insights", coletado_em: ps?.fetchedAt ?? now });
        signals.push({ chave: "viewport", valor_json: ps?.viewportOk ?? null, fonte: "pagespeed_insights", coletado_em: ps?.fetchedAt ?? now });
      }
    }
  } else {
    signals.push({ chave: "instagram", valor_json: lead.instagram, fonte: "google_places", coletado_em: lead.ultima_coleta ?? now });
  }

  const result = computeScore(facts, opts.weights);
  const pontos = new Map<string, number>();
  for (const p of result.parts) pontos.set(WEIGHT_SIGNAL[p.key], (pontos.get(WEIGHT_SIGNAL[p.key]) ?? 0) + p.pontos);

  await sb.from("lead_signals").upsert(
    signals.map((s) => ({ ...s, user_id: lead.user_id, lead_id: lead.id, pontos: pontos.get(s.chave) ?? 0 })),
    { onConflict: "lead_id,chave" },
  );
  const pacote = suggestPackage(opts.services, lead.nicho);
  await sb
    .from("leads")
    .update({ score: result.score, faixa: result.faixa, instagram: facts.instagram ?? null, pacote_sugerido_id: pacote?.id ?? null, enriquecimento: "feito", ultima_coleta: now })
    .eq("id", lead.id);
  return { score: result.score, faixa: result.faixa, pagespeedCalls, siteMudou: false };
}
