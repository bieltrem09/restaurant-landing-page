import type { Metadata } from "next";
import { OrdeliryPage } from "@/components/OrdeliryPage";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ordeliry" };

export default async function Page({ searchParams }: PageProps<"/ordeliry">) {
  const sp = await searchParams;
  const sb = await supabaseServer();
  const { data: threads } = await sb.from("ai_threads").select("id, titulo, modo, lead_id, atualizado_em, leads(nome)").order("atualizado_em", { ascending: false }).limit(60);
  const rows = (threads ?? []).map((t) => ({ ...t, leads: Array.isArray(t.leads) ? (t.leads[0] ?? null) : t.leads })) as Array<{ id: string; titulo: string; modo: string; lead_id: string | null; atualizado_em: string; leads: { nome: string } | null }>;
  return <OrdeliryPage threads={rows} initialThread={typeof sp.t === "string" ? sp.t : null} />;
}
