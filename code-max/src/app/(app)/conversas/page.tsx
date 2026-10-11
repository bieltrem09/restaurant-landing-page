import type { Metadata } from "next";
import { ConversationsView } from "@/components/ConversationsView";
import { supabaseServer } from "@/lib/supabase/server";
import type { Interaction } from "@/lib/types";

export const metadata: Metadata = { title: "Conversas" };

export default async function ConversasPage({ searchParams }: PageProps<"/conversas">) {
  const sp = await searchParams;
  const sb = await supabaseServer();
  const { data: leads } = await sb.from("leads").select("id, nome, nicho, telefone, telefone_internacional, ultimo_contato_em").in("status", ["salvo", "cliente"]).order("ultimo_contato_em", { ascending: false, nullsFirst: false }).limit(200);
  const leadId = typeof sp.lead === "string" ? sp.lead : (leads?.[0]?.id ?? null);
  let interactions: Interaction[] = [];
  if (leadId) {
    const { data } = await sb.from("interactions").select("*").eq("lead_id", leadId).order("ocorreu_em");
    interactions = (data ?? []) as Interaction[];
  }
  return <ConversationsView leads={leads ?? []} leadId={leadId} interactions={interactions} />;
}
