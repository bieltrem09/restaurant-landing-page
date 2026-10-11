import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, parseJson, rateLimit, requireApiUser } from "@/lib/api";
import { processEnrichJobs } from "@/lib/jobs/enrich";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Worker acionado pelo navegador enquanto a busca está aberta (o cron cobre o que sobrar). */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`enrich:${user.id}`, 40, 60_000);
  const { searchId } = await parseJson(req, z.object({ searchId: z.string().uuid() }));
  const sb = await supabaseServer();
  const r = await processEnrichJobs(sb, { max: 3, searchId, userId: user.id });
  const { data: leads } = await sb.from("leads").select("enriquecimento").eq("search_id", searchId);
  const total = leads?.length ?? 0;
  const feitos = (leads ?? []).filter((l) => l.enriquecimento === "feito" || l.enriquecimento === "erro").length;
  if (total && feitos === total) await sb.from("searches").update({ status: "concluida" }).eq("id", searchId);
  return NextResponse.json({ processed: r.processed, total, feitos, concluido: total > 0 && feitos === total });
});
