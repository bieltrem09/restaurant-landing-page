import { NextResponse } from "next/server";
import { handler, requireApiUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

/** Busca rápida de leads por nome (paleta Ctrl+K e seletores). */
export const GET = handler(async (req: Request) => {
  await requireApiUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/[%_,()]/g, "").trim().slice(0, 60);
  const sb = await supabaseServer();
  let query = sb.from("leads").select("id, nome, nicho, bairro, score, faixa, status").neq("status", "nao_contatar").order("score", { ascending: false }).limit(8);
  if (q) query = query.ilike("nome", `%${q}%`);
  else query = query.in("status", ["salvo", "cliente"]);
  const { data } = await query;
  return NextResponse.json({ leads: data ?? [] });
});
