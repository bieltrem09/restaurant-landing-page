import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { classifyWebsite } from "./score";

/** Dados públicos de um token: nunca expõe score, anotações ou histórico interno. */
export async function loadPublic(token: string, tipo: "diagnostico" | "proposta") {
  if (!/^[a-f0-9]{24}$/.test(token)) return null;
  const sb = supabaseAdmin();
  const { data: tracker } = await sb.from("trackers").select("id, user_id, lead_id, tipo").eq("token", token).eq("tipo", tipo).maybeSingle();
  if (!tracker) return null;
  const [{ data: lead }, { data: profile }, { data: signals }] = await Promise.all([
    sb.from("leads").select("id, nome, nicho, bairro, cidade, website, rating, rating_count, search_id, place_id").eq("id", tracker.lead_id).single(),
    sb.from("profiles").select("nome, estudio, whatsapp").eq("user_id", tracker.user_id).single(),
    sb.from("lead_signals").select("chave, valor_json, coletado_em").eq("lead_id", tracker.lead_id),
  ]);
  if (!lead) return null;
  // 3 concorrentes reais do mesmo nicho e bairro, vindos da mesma busca do Places.
  let competitors: Array<{ nome: string; website: string | null; rating: number | null; rating_count: number | null }> = [];
  if (lead.search_id) {
    const { data } = await sb
      .from("leads")
      .select("nome, website, rating, rating_count, bairro")
      .eq("search_id", lead.search_id)
      .neq("id", lead.id)
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(20);
    const sameBairro = (data ?? []).filter((c) => !lead.bairro || c.bairro === lead.bairro);
    competitors = (sameBairro.length >= 3 ? sameBairro : (data ?? [])).filter((c) => classifyWebsite(c.website) === "proprio").slice(0, 3);
  }
  const portfolio = (await sb.from("portfolio_items").select("titulo, url, nicho").eq("user_id", tracker.user_id).eq("nicho", lead.nicho).limit(4)).data ?? [];
  return { tracker, lead, profile, signals: signals ?? [], competitors, portfolio, sb };
}
