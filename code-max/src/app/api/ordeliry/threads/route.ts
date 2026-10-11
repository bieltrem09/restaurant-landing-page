import { NextResponse } from "next/server";
import { handler, requireApiUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

/** Lista conversas (?lead=) ou devolve as mensagens de uma (?id=). */
export const GET = handler(async (req: Request) => {
  await requireApiUser();
  const url = new URL(req.url);
  const sb = await supabaseServer();
  const id = url.searchParams.get("id");
  if (id) {
    const { data } = await sb.from("ai_messages").select("id, role, conteudo, feedback, criado_em").eq("thread_id", id).order("criado_em");
    return NextResponse.json({ messages: data ?? [] });
  }
  let q = sb.from("ai_threads").select("id, titulo, modo, lead_id, atualizado_em, leads(nome)").order("atualizado_em", { ascending: false }).limit(50);
  const lead = url.searchParams.get("lead");
  if (lead) q = q.eq("lead_id", lead);
  const { data } = await q;
  return NextResponse.json({ threads: data ?? [] });
});
