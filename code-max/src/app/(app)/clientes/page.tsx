import type { Metadata } from "next";
import { ClientsView } from "@/components/ClientsView";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clientes e financeiro" };

export default async function ClientesPage() {
  const sb = await supabaseServer();
  const [{ data: clients }, { data: projects }, { data: subs }, { data: payments }] = await Promise.all([
    sb.from("clients").select("id, nome, nicho, telefone, lead_id, criado_em").order("criado_em", { ascending: false }),
    sb.from("projects").select("id, client_id, titulo, status, progresso, entrega_prevista, url_site").order("criado_em", { ascending: false }),
    sb.from("subscriptions").select("id, client_id, descricao, valor, dia_vencimento, ativa, inicio"),
    sb.from("payments").select("id, client_id, subscription_id, valor, forma, pago_em, referencia").order("pago_em", { ascending: false }).limit(300),
  ]);
  return <ClientsView clients={clients ?? []} projects={projects ?? []} subs={subs ?? []} payments={payments ?? []} now={new Date().toISOString()} />;
}
