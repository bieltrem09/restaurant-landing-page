import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";
import { loadDashboard } from "@/lib/dashboard-data";
import type { Period } from "@/lib/dates";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Visão geral" };

const PERIODS = ["dia", "semana", "mes", "ano", "custom"] as const;

export default async function Page({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const raw = typeof sp.period === "string" ? sp.period : "mes";
  const period: Period = (PERIODS as readonly string[]).includes(raw) ? (raw as Period) : "mes";
  const from = typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : undefined;
  const to = typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : undefined;
  const sb = await supabaseServer();
  const data = await loadDashboard(sb, { period: period === "custom" && (!from || !to) ? "mes" : period, from, to });
  return <Dashboard data={data} compare={sp.compare !== "0"} from={from} to={to} />;
}
