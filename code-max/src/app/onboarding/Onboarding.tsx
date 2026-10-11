"use client";

import { ArrowRight, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeOnboarding } from "@/app/actions";
import { GoalsEditor, PortfolioEditor, ProfileForm, ServicesEditor, TargetsEditor } from "@/components/settings";
import { ToastProvider } from "@/components/ui";
import type { PortfolioItem, Profile, Service } from "@/lib/types";

const STEPS = ["Seu perfil", "Catálogo de serviços", "Nichos e regiões", "Meta do mês"];

export function Onboarding({ profile, services, portfolio }: { profile: Profile; services: Service[]; portfolio: PortfolioItem[] }) {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  async function finish() {
    const r = await completeOnboarding();
    if (r.ok) {
      router.push("/radar");
      router.refresh();
    }
  }

  return (
    <ToastProvider>
      <div className="auth-wrap" style={{ alignItems: "start", paddingTop: 32 }}>
        <div className="auth-card" style={{ width: "min(760px, 100%)" }}>
          <div className="brand" style={{ color: "var(--ink)" }}>
            <span className="brand-mark">
              <Store size={20} />
            </span>
            <div>
              Code Max<small style={{ color: "var(--ink-3)" }}>Primeiros passos · {step + 1} de 4</small>
            </div>
          </div>
          <div className="seg" role="tablist" aria-label="Etapas" style={{ display: "flex", flexWrap: "wrap" }}>
            {STEPS.map((s, i) => (
              <button key={s} type="button" role="tab" aria-selected={i === step} onClick={() => setStep(i)} style={i === step ? { background: "var(--surface)", color: "var(--ink)" } : undefined}>
                {i + 1}. {s}
              </button>
            ))}
          </div>

          {step === 0 && (
            <section style={{ display: "grid", gap: 16 }}>
              <p className="muted" style={{ margin: 0 }}>Tudo aqui alimenta a Ordeliry. O nome aparece nas mensagens que ela escreve para você enviar.</p>
              <ProfileForm profile={profile} onSaved={next} />
              <h2 className="card-t">Portfólio (sites já entregues)</h2>
              <PortfolioEditor items={portfolio} />
            </section>
          )}
          {step === 1 && (
            <section style={{ display: "grid", gap: 12 }}>
              <p className="muted" style={{ margin: 0 }}>
                O catálogo é a única fonte de preços, prazos e entregas da Ordeliry. Ex.: “Cardápio digital com QR code — R$ 0 de implantação + R$ 100/mês com manutenção”.
              </p>
              <ServicesEditor services={services} />
              <div>
                <button className="btn btn-lime" type="button" onClick={next}>
                  Continuar <ArrowRight size={16} />
                </button>
              </div>
            </section>
          )}
          {step === 2 && (
            <section style={{ display: "grid", gap: 12 }}>
              <TargetsEditor profile={profile} onSaved={next} />
            </section>
          )}
          {step === 3 && (
            <section style={{ display: "grid", gap: 12 }}>
              <GoalsEditor profile={profile} onSaved={finish} />
              <button className="link-btn" type="button" onClick={finish} style={{ justifySelf: "start" }}>
                Pular e ir para o Radar
              </button>
            </section>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
