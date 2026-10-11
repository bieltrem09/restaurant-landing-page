import type { Metadata } from "next";
import { PipelineBoard } from "@/components/PipelineBoard";
import { getServices } from "@/lib/data";
import { periodRange } from "@/lib/dates";
import { pipelineTotals, type Stage } from "@/lib/pipeline";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const sb = await supabaseServer();
  const now = new Date();
  const [{ data: deals }, services, { data: views }] = await Promise.all([
    sb
      .from("deals")
      .select("id, lead_id, etapa, valor_implantacao, mensalidade, probabilidade, entrou_na_etapa_em, proximo_followup_em, criado_em, ganho_em, service_id, leads(nome, nicho, score, faixa, telefone, telefone_internacional, ultimo_contato_em)")
      .or(`etapa.not.in.(ganho,perdido),entrou_na_etapa_em.gte.${new Date(now.getTime() - 30 * 86_400_000).toISOString()}`)
      .order("entrou_na_etapa_em", { ascending: false }),
    getServices(sb),
    sb.from("track_events").select("lead_id").eq("evento", "open"),
  ]);
  const viewCount: Record<string, number> = {};
  for (const v of views ?? []) viewCount[v.lead_id] = (viewCount[v.lead_id] ?? 0) + 1;
  const rows = (deals ?? []).map((d) => ({ ...d, leads: Array.isArray(d.leads) ? d.leads[0] : d.leads, vistos: viewCount[d.lead_id] ?? 0 }));
  const { data: allWon } = await sb.from("deals").select("etapa, valor_implantacao, mensalidade, criado_em, ganho_em").eq("etapa", "ganho");
  const totals = pipelineTotals(
    [...rows.filter((d) => d.etapa !== "ganho"), ...(allWon ?? [])].map((d) => ({ ...d, etapa: d.etapa as Stage, valor_implantacao: Number(d.valor_implantacao), mensalidade: Number(d.mensalidade) })),
    now,
    periodRange("mes", now).from,
  );
  return <PipelineBoard deals={rows as never} services={services.filter((s) => s.ativo)} totals={totals} now={now.toISOString()} />;
}
