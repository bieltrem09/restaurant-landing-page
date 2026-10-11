import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getProfile } from "@/lib/data";
import { monthName, periodRange, spParts } from "@/lib/dates";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();
  if (!profile.onboarding_concluido) redirect("/onboarding");
  const sb = await supabaseServer();
  const now = new Date();
  const month = periodRange("mes", now);
  const [pays, hot, open] = await Promise.all([
    sb.from("payments").select("valor").gte("pago_em", month.from.toISOString()).lt("pago_em", month.to.toISOString()),
    sb.from("leads").select("id", { count: "exact", head: true }).eq("status", "novo").eq("faixa", "quente"),
    sb.from("deals").select("id", { count: "exact", head: true }).not("etapa", "in", "(ganho,perdido)"),
  ]);
  const recebido = (pays.data ?? []).reduce((s, p) => s + Number(p.valor), 0);
  return (
    <Shell
      profile={{ nome: profile.nome, estudio: profile.estudio, whatsapp: profile.whatsapp, tema: profile.tema }}
      goal={{ meta: Number(profile.meta_mensal), recebido, mesLabel: monthName(spParts(now).m) }}
      badges={{ radar: hot.count ?? 0, pipeline: open.count ?? 0 }}
    >
      {children}
    </Shell>
  );
}
