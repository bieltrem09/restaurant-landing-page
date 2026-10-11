import type { Metadata } from "next";
import { RadarView } from "@/components/RadarView";
import { getProfile } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Radar de Leads" };

export default async function RadarPage() {
  const profile = await getProfile();
  const sb = await supabaseServer();
  const { data: searches } = await sb.from("searches").select("id, nicho, cidade, bairro, raio_km, total_resultados, criada_em, status").order("criada_em", { ascending: false }).limit(8);
  return <RadarView profile={{ nichos_alvo: profile.nichos_alvo, regioes_alvo: profile.regioes_alvo, cidade_base: profile.cidade_base }} recent={searches ?? []} />;
}
