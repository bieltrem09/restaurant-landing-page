import type { Metadata } from "next";
import { DncList, GoalsEditor, OrdeliryPrefs, PlacesLimitEditor, PortfolioEditor, ProfileForm, ServicesEditor, TargetsEditor, WeightsEditor } from "@/components/settings";
import { getPortfolio, getProfile, getServices } from "@/lib/data";
import { placesUsageThisMonth } from "@/lib/radar";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const profile = await getProfile();
  const sb = await supabaseServer();
  const [services, portfolio, { data: dnc }, usadas] = await Promise.all([
    getServices(sb),
    getPortfolio(sb),
    sb.from("do_not_contact").select("id, nome, telefone, motivo, criado_em").order("criado_em", { ascending: false }),
    placesUsageThisMonth(sb, profile.user_id),
  ]);
  const sections = [
    { id: "perfil", title: "Perfil do vendedor", body: <ProfileForm profile={profile} /> },
    { id: "catalogo", title: "Catálogo de serviços", body: <ServicesEditor services={services} /> },
    { id: "portfolio", title: "Portfólio", body: <PortfolioEditor items={portfolio} /> },
    { id: "alvos", title: "Nichos e regiões-alvo", body: <TargetsEditor profile={profile} /> },
    { id: "metas", title: "Metas", body: <GoalsEditor profile={profile} /> },
    { id: "ordeliry", title: "Ordeliry e horário comercial", body: <OrdeliryPrefs profile={profile} /> },
    { id: "score", title: "Pesos do score", body: <WeightsEditor profile={profile} /> },
    { id: "places", title: "Custo do Google Places", body: <PlacesLimitEditor profile={profile} usadas={usadas} padrao={Number(process.env.PLACES_MONTHLY_CALL_LIMIT ?? 2000)} /> },
    { id: "dnc", title: "Não contatar (LGPD)", body: <DncList items={dnc ?? []} /> },
  ];
  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Ajustes</span>
          <h1>Configurações que alimentam a Ordeliry</h1>
        </div>
      </header>
      <div className="grid">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className={`card ${s.id === "score" || s.id === "catalogo" ? "span-12" : "span-12"}`}>
            <header className="card-h">
              <h2 className="card-t">{s.title}</h2>
            </header>
            {s.body}
          </section>
        ))}
      </div>
    </>
  );
}
