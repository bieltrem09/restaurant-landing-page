import { NextResponse } from "next/server";
import { handler, parseJson, rateLimit, requireApiUser } from "@/lib/api";
import { estimateCalls, placesUsageThisMonth, queryCacheKey } from "@/lib/radar";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { searchSchema } from "../schema";

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`estimate:${user.id}`, 60, 60_000);
  const input = await parseJson(req, searchSchema);
  const sb = await supabaseServer();
  const admin = supabaseAdmin();
  const key = queryCacheKey({ ...input, raioKm: input.raioKm });
  const { data: cached } = await admin.from("places_cache").select("coletado_em").eq("place_id", key).maybeSingle();
  const fresh = !!cached && Date.now() - new Date(cached.coletado_em).getTime() < 30 * 86_400_000;
  const { data: profile } = await sb.from("profiles").select("places_limite_mensal").eq("user_id", user.id).single();
  const limite = profile?.places_limite_mensal ?? Number(process.env.PLACES_MONTHLY_CALL_LIMIT ?? 2000);
  const usadas = await placesUsageThisMonth(sb, user.id);
  const est = estimateCalls({ hasPoint: input.lat != null && input.lng != null, cachedQuery: fresh });
  return NextResponse.json({ ...est, cache: fresh, usadas, limite, saldo: Math.max(0, limite - usadas), permitido: usadas + est.max <= limite });
});
