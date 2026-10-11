import { NextResponse } from "next/server";
import { ApiError, handler, requireApiUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

/** Leads de uma busca, com sinais (para os chips) e pacote sugerido. */
export const GET = handler(async (req: Request) => {
  await requireApiUser();
  const searchId = new URL(req.url).searchParams.get("searchId");
  if (!searchId || !/^[0-9a-f-]{36}$/.test(searchId)) throw new ApiError(400, "searchId inválido.");
  const sb = await supabaseServer();
  const [{ data: search }, { data: leads }] = await Promise.all([
    sb.from("searches").select("*").eq("id", searchId).maybeSingle(),
    sb
      .from("leads")
      .select("id, nome, nicho, bairro, cidade, lat, lng, distancia_km, website, rating, rating_count, score, faixa, status, enriquecimento, ultimo_contato_em, instagram, services:pacote_sugerido_id(nome, preco_implantacao, mensalidade), lead_signals(chave, valor_json, pontos)")
      .eq("search_id", searchId)
      .neq("status", "nao_contatar")
      .order("score", { ascending: false }),
  ]);
  if (!search) throw new ApiError(404, "Busca não encontrada.");
  return NextResponse.json({ search, leads: leads ?? [] });
});
