import { NextResponse } from "next/server";
import { ApiError, handler, requireApiUser } from "@/lib/api";
import { getLeadDetail } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/leads/[id]">) => {
  await requireApiUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const lead = await getLeadDetail(sb, id);
  if (!lead) throw new ApiError(404, "Lead não encontrado.");
  return NextResponse.json(lead);
});
