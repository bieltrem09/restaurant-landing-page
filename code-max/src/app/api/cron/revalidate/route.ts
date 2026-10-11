import { NextResponse } from "next/server";
import { classifyWebsite } from "@/lib/score";
import { processEnrichJobs } from "@/lib/jobs/enrich";
import { PLACES_FIELDS, type Place } from "@/lib/radar";
import { supabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * Vercel Cron (diário). Protegido por CRON_SECRET.
 * 1) Revalida no Google os leads salvos há mais de 30 dias e alerta quando um lead sem site passa a ter site.
 * 2) Processa jobs de enriquecimento que ficaram pendentes.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const sb = supabaseAdmin();
  const limit = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: stale } = await sb
    .from("leads")
    .select("id, user_id, place_id, website, nome")
    .in("status", ["salvo", "novo"])
    .lt("ultima_coleta", limit)
    .limit(40);

  let revalidados = 0;
  const key = process.env.GOOGLE_MAPS_API_KEY;
  for (const lead of stale ?? []) {
    if (!key) break;
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(lead.place_id)}?languageCode=pt-BR`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": PLACES_FIELDS.map((f) => f.replace("places.", "")).join(",") },
      signal: AbortSignal.timeout(10_000),
    });
    await sb.from("api_usage").insert({ user_id: lead.user_id, api: "places", chamadas: 1 });
    if (!res.ok) continue;
    const p = (await res.json()) as Place;
    await sb.from("places_cache").upsert({ place_id: p.id, payload_json: p, coletado_em: new Date().toISOString() });
    const antes = classifyWebsite(lead.website);
    const depois = classifyWebsite(p.websiteUri);
    if (antes !== "proprio" && depois === "proprio") {
      await sb.from("lead_alerts").insert({ user_id: lead.user_id, lead_id: lead.id, tipo: "ganhou_site", texto: `${lead.nome} passou a ter site: ${p.websiteUri}` });
      await sb.from("activity").insert({ user_id: lead.user_id, lead_id: lead.id, tipo: "alerta", texto: `${lead.nome} passou a ter site próprio` });
    }
    await sb
      .from("leads")
      .update({
        website: p.websiteUri ?? null,
        rating: p.rating ?? null,
        rating_count: p.userRatingCount ?? null,
        telefone: p.nationalPhoneNumber ?? null,
        telefone_internacional: p.internationalPhoneNumber ?? null,
        ultima_coleta: new Date().toISOString(),
        enriquecimento: "pendente",
      })
      .eq("id", lead.id);
    await sb.from("jobs").insert({ user_id: lead.user_id, tipo: "enrich_lead", payload: { lead_id: lead.id } });
    revalidados++;
  }
  const jobs = await processEnrichJobs(sb, { max: 8 });
  return NextResponse.json({ revalidados, enriquecidos: jobs.processed });
}
