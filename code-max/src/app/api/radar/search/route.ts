import { NextResponse } from "next/server";
import { handler, parseJson, rateLimit, requireApiUser, ApiError } from "@/lib/api";
import { getDoNotContact, logActivity } from "@/lib/data";
import { NICHE_BY_KEY } from "@/lib/niches";
import { estimateCalls, geocodeArea, placeToLead, placesUsageThisMonth, queryCacheKey, recordUsage, textSearchAll, type Place } from "@/lib/radar";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { searchSchema } from "../schema";

export const maxDuration = 60;

type CachedQuery = { center: { lat: number; lng: number }; places: Place[] };

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`search:${user.id}`, 10, 60_000);
  const input = await parseJson(req, searchSchema);
  const sb = await supabaseServer();
  const admin = supabaseAdmin();
  const niche = NICHE_BY_KEY[input.nicho];

  // Limite mensal
  const { data: profile } = await sb.from("profiles").select("places_limite_mensal").eq("user_id", user.id).single();
  const limite = profile?.places_limite_mensal ?? Number(process.env.PLACES_MONTHLY_CALL_LIMIT ?? 2000);
  const usadas = await placesUsageThisMonth(sb, user.id);

  const key = queryCacheKey(input);
  const { data: cacheRow } = await admin.from("places_cache").select("payload_json, coletado_em").eq("place_id", key).maybeSingle();
  let payload: CachedQuery | null =
    cacheRow && Date.now() - new Date(cacheRow.coletado_em).getTime() < 30 * 86_400_000 ? (cacheRow.payload_json as CachedQuery) : null;

  let calls = 0;
  const { data: search } = await sb
    .from("searches")
    .insert({ user_id: user.id, nicho: input.nicho, cidade: input.cidade, bairro: input.bairro ?? null, lat: input.lat ?? null, lng: input.lng ?? null, raio_km: input.raioKm })
    .select("id")
    .single();
  if (!search) throw new ApiError(500, "Não foi possível registrar a busca.");

  try {
    if (!payload) {
      const est = estimateCalls({ hasPoint: input.lat != null && input.lng != null, cachedQuery: false });
      if (usadas + est.max > limite)
        throw new ApiError(429, `Limite mensal do Google Places atingido (${usadas}/${limite} chamadas). Ajuste o limite em Ajustes.`);
      let center = input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : null;
      if (!center) {
        center = await geocodeArea(input.cidade, input.bairro);
        calls++;
        if (!center) throw new ApiError(404, "Não encontramos essa cidade/bairro no Google. Confira a grafia.");
      }
      const query = `${niche.query} em ${[input.bairro, input.cidade].filter(Boolean).join(", ")}`;
      const r = await textSearchAll({ query, lat: center.lat, lng: center.lng, raioKm: input.raioKm });
      calls += r.calls;
      payload = { center, places: r.places };
      await admin.from("places_cache").upsert([
        { place_id: key, payload_json: payload, coletado_em: new Date().toISOString() },
        ...r.places.map((p) => ({ place_id: p.id, payload_json: p, coletado_em: new Date().toISOString() })),
      ]);
    }
  } catch (e) {
    await recordUsage(sb, user.id, "places", calls);
    await sb.from("searches").update({ status: "erro", chamadas_usadas: calls, erro: e instanceof Error ? e.message.slice(0, 300) : "erro" }).eq("id", search.id);
    throw e instanceof ApiError ? e : new ApiError(502, e instanceof Error ? e.message : "Falha ao consultar o Google Places.");
  }
  await recordUsage(sb, user.id, "places", calls);

  // Filtra: só operando, fora da lista "não contatar", dentro do raio, sem duplicados.
  const dnc = await getDoNotContact(sb);
  const seen = new Set<string>();
  const rows = payload.places
    .filter((p) => p.businessStatus === "OPERATIONAL")
    .filter((p) => !dnc.places.has(p.id))
    .filter((p) => !dnc.phones.has((p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? "").replace(/\D/g, "")))
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .map((p) => placeToLead(p, input.nicho, payload!.center))
    .filter((l) => l.distancia_km === null || l.distancia_km <= input.raioKm);

  // Upsert preservando status/histórico de leads que o usuário já tinha.
  const { data: existing } = await sb.from("leads").select("id, place_id, status").in("place_id", rows.map((r) => r.place_id));
  const byPlace = new Map((existing ?? []).map((e) => [e.place_id, e]));
  const now = new Date().toISOString();
  const toInsert = rows.filter((r) => !byPlace.has(r.place_id)).map((r) => ({ ...r, user_id: user.id, search_id: search.id, ultima_coleta: now }));
  if (toInsert.length) await sb.from("leads").insert(toInsert);
  for (const r of rows.filter((r) => byPlace.has(r.place_id))) {
    const e = byPlace.get(r.place_id)!;
    if (e.status === "nao_contatar") continue;
    await sb.from("leads").update({ ...r, search_id: search.id, ultima_coleta: now, enriquecimento: "pendente" }).eq("id", e.id);
  }

  const { data: leads } = await sb.from("leads").select("id").eq("search_id", search.id).neq("status", "nao_contatar");
  if (leads?.length) {
    await sb.from("leads").update({ enriquecimento: "pendente" }).eq("search_id", search.id);
    await sb.from("jobs").insert(leads.map((l) => ({ user_id: user.id, tipo: "enrich_lead", payload: { lead_id: l.id, search_id: search.id } })));
  }
  await sb.from("searches").update({ status: "enriquecendo", chamadas_usadas: calls, total_resultados: leads?.length ?? 0 }).eq("id", search.id);
  await logActivity(sb, user.id, "busca", `Radar: ${leads?.length ?? 0} ${niche.label.toLowerCase()}s em ${[input.bairro, input.cidade].filter(Boolean).join(", ")}`);

  return NextResponse.json({ searchId: search.id, total: leads?.length ?? 0, calls, cache: calls === 0, center: payload.center });
});
