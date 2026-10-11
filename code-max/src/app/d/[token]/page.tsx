import { AlertTriangle, CheckCircle2, MessageCircle, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tracker } from "@/components/public/Tracker";
import { waLink } from "@/lib/format";
import { nicheLabel } from "@/lib/niches";
import { loadPublic } from "@/lib/public-data";
import { classifyWebsite } from "@/lib/score";

export const metadata: Metadata = { title: "Diagnóstico de presença digital", robots: { index: false } };

type Finding = { bad: boolean; title: string; text: string };

export default async function DiagnosticoPage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  const d = await loadPublic(token, "diagnostico");
  if (!d) notFound();
  const { lead, profile, signals, competitors, portfolio } = d;
  const sv = (k: string) => signals.find((s) => s.chave === k)?.valor_json as unknown;
  const site = classifyWebsite(lead.website);
  const ps = sv("pagespeed") as { performance?: number; lcpMs?: number } | null;
  const findings: Finding[] = [];

  if (site === "nenhum") findings.push({ bad: true, title: "Não encontramos um site de vocês no Google", text: "Quem procura no celular por um lugar como o seu acaba encontrando primeiro quem tem site, e liga para eles." });
  if (site === "rede_social") findings.push({ bad: true, title: "O link do Google leva para uma rede social", text: "A rede social não aparece bem para quem pesquisa no Google, e o cliente precisa ter conta para ver tudo." });
  if (site === "marketplace") findings.push({ bad: true, title: "O link do Google leva para um marketplace", text: "Cada pedido feito por lá paga taxa. Um cardápio próprio recebe o pedido direto no WhatsApp, sem comissão." });
  if (sv("site_online") && (sv("site_online") as { online?: boolean }).online === false) findings.push({ bad: true, title: "O site estava fora do ar quando verificamos", text: "Quem clica no link do Google encontra uma página com erro e desiste." });
  if (ps?.performance != null)
    findings.push(
      ps.performance < 50
        ? { bad: true, title: `O site é lento no celular (nota ${ps.performance} de 100 no Google PageSpeed)`, text: `A primeira imagem leva cerca de ${ps.lcpMs ? (ps.lcpMs / 1000).toFixed(1).replace(".", ",") : "vários"} segundos para aparecer. Muita gente desiste antes disso.` }
        : { bad: ps.performance < 70, title: `Velocidade no celular: ${ps.performance} de 100`, text: ps.performance < 70 ? "Dá para carregar mais rápido, e o Google favorece sites rápidos." : "Boa velocidade." },
    );
  if (sv("viewport") === false) findings.push({ bad: true, title: "O site não se ajusta bem ao celular", text: "Texto pequeno e botões difíceis de tocar fazem o cliente sair." });
  if (sv("https") === false) findings.push({ bad: true, title: "O site não tem cadeado de segurança (HTTPS)", text: "O navegador mostra “Não seguro” ao lado do endereço." });
  if (sv("whatsapp_button") === false) findings.push({ bad: true, title: "Não há botão de WhatsApp no site", text: "O cliente precisa copiar o número para falar com vocês." });
  if (lead.rating != null && lead.rating >= 4.5) findings.push({ bad: false, title: `Nota ${String(lead.rating).replace(".", ",")} no Google com ${lead.rating_count} avaliações`, text: "Uma reputação ótima, que merece ser vista por mais gente." });

  const nome = profile?.estudio || profile?.nome || "nosso estúdio";
  const wa = waLink(profile?.whatsapp, `Olá! Vi o diagnóstico do ${lead.nome} e quero conversar.`);

  return (
    <div className="public">
      <div className="public-inner">
        <span className="eyebrow">{nome} · diagnóstico de presença digital</span>
        <h1>{lead.nome}</h1>
        <p className="lead-p">
          O que um cliente encontra hoje quando procura por {nicheLabel(lead.nicho).toLowerCase()} {lead.bairro ? `em ${lead.bairro}` : "na região"}. Dados públicos do Google, verificados em{" "}
          {signals[0] ? new Date(signals[0].coletado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}.
        </p>

        <section className="card">
          <h2 className="card-t" style={{ marginBottom: 8 }}>O que encontramos</h2>
          {findings.map((f, i) => (
            <div key={i} className={`finding ${f.bad ? "bad" : "good"}`}>
              <span className="fi-ico">{f.bad ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}</span>
              <div>
                <b>{f.title}</b>
                <p>{f.text}</p>
              </div>
            </div>
          ))}
        </section>

        {!!competitors.length && (
          <section className="card">
            <h2 className="card-t" style={{ marginBottom: 8 }}>Quem aparece ao lado de vocês</h2>
            <p className="muted" style={{ marginTop: 0 }}>Negócios do mesmo segmento na mesma busca do Google.</p>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Negócio</th>
                  <th>Site próprio</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>{lead.nome}</b>
                  </td>
                  <td>{site === "proprio" ? "Sim" : "Não"}</td>
                  <td>{lead.rating ?? "—"}</td>
                </tr>
                {competitors.map((c) => (
                  <tr key={c.nome}>
                    <td>{c.nome}</td>
                    <td>Sim</td>
                    <td>{c.rating ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="card">
          <h2 className="card-t" style={{ marginBottom: 8 }}>
            <Smartphone size={16} /> Proposta de solução
          </h2>
          <p style={{ marginTop: 0 }}>
            Um site rápido, feito para o celular, com botão de WhatsApp e que aparece no Google, para que quem já procura por vocês encontre e entre em contato direto.
          </p>
          {!!portfolio.length && (
            <p className="muted">
              Exemplos do mesmo segmento:{" "}
              {portfolio.map((p, i) => (
                <span key={p.url}>
                  {i > 0 && ", "}
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.titulo}
                  </a>
                </span>
              ))}
            </p>
          )}
          <a className="btn btn-lime" href={wa} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> Falar no WhatsApp
          </a>
        </section>
        <p className="muted" style={{ fontSize: 12 }}>
          Diagnóstico preparado por {nome} com dados públicos (Google Places e Google PageSpeed Insights). <a href="/privacidade">Privacidade</a>
        </p>
      </div>
      <Tracker token={token} />
    </div>
  );
}
