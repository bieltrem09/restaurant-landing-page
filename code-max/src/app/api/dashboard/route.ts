import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handler, requireApiUser } from "@/lib/api";
import { loadDashboard } from "@/lib/dashboard-data";
import { supabaseServer } from "@/lib/supabase/server";

const q = z.object({
  period: z.enum(["dia", "semana", "mes", "ano", "custom"]).default("mes"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = handler(async (req: Request) => {
  await requireApiUser();
  const url = new URL(req.url);
  const r = q.safeParse(Object.fromEntries(url.searchParams));
  if (!r.success) throw new ApiError(400, "Parâmetros de período inválidos.");
  if (r.data.period === "custom" && (!r.data.from || !r.data.to)) throw new ApiError(400, "Intervalo personalizado precisa de from e to.");
  const sb = await supabaseServer();
  return NextResponse.json(await loadDashboard(sb, r.data));
});
