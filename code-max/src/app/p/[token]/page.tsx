import { Check, HelpCircle, MessageCircle, X } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tracker } from "@/components/public/Tracker";
import { money, waLink } from "@/lib/format";
import { loadPublic } from "@/lib/public-data";
import { classifyWebsite } from "@/lib/score";

export const metadata: Metadata = { title: "Proposta", robots: { index: false } };

type Conteudo = { servico: { nome: string; descricao: string; inclui: string[]; nao_inclui: string[]; preco_implantacao: number; mensalidade: number; prazo_dias: number } };

export default async function PropostaPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const d = await loadPublic(token, "proposta");
  if (!d) notFound();
  const { data: proposal } = await d.sb.from("proposals").select("conteudo_json").eq("tracker_id", d.tracker.id).maybeSingle();
  if (!proposal) notFound();
  const s = (proposal.conteudo_json as Conteudo).servico;
  const { lead, profile, portfolio } = d;
  const nome = profile?.estudio || profile?.nome || "nosso estúdio";
  const site = classifyWebsite(lead.website);
  return (
    <div className="public">
      <div className="public-inner">
        <span className="eyebrow">Proposta · {nome}</span>
        <h1>{s.nome} para {lead.nome}</h1>
        <p className="lead-p">
          {site === "proprio" ? "Hoje vocês já têm um site; a proposta é deixá-lo rápido no celular e pronto para trazer contato pelo WhatsApp." : "Hoje quem procura vocês no Google não encontra um site próprio. A proposta é resolver isso."}
          {lead.rating != null && lead.rating >= 4.5 ? ` Com nota ${String(lead.rating).replace(".", ",")} no Google, vale mostrar isso para mais gente.` : ""}
        </p>

        <section className="card">
          <h2 className="card-t" style={{ marginBottom: 8 }}>O que será entregue</h2>
          {s.descricao && <p style={{ marginTop: 0 }}>{s.descricao}</p>}
          <div className="pkg">
            <ul>
              {s.inclui.map((x) => (
                <li key={x}>
                  <Check />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          {!!s.nao_inclui.length && (
            <>
              <h3 className="card-t" style={{ fontSize: 14, marginTop: 14 }}>Não inclui</h3>
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 6 }}>
                {s.nao_inclui.map((x) => (
                  <li key={x} className="muted" style={{ display: "flex", gap: 8 }}>
                    <X size={15} />
                    {x}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <h2 className="card-t" style={{ marginBottom: 8 }}>Investimento</h2>
          <div className="facts">
            <div>
              <span className="num">{money(Number(s.preco_implantacao))}</span>
              <small>implantação</small>
            </div>
            <div>
              <span className="num">{money(Number(s.mensalidade))}</span>
              <small>por mês</small>
            </div>
            <div>
              <span className="num">{s.prazo_dias} dias</span>
              <small>prazo de entrega</small>
            </div>
          </div>
        </section>

        {!!portfolio.length && (
          <section className="card">
            <h2 className="card-t" style={{ marginBottom: 8 }}>Trabalhos do mesmo segmento</h2>
            {portfolio.map((p) => (
              <div key={p.url} className="list-row">
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.titulo}
                </a>
              </div>
            ))}
          </section>
        )}

        <div className="page-actions">
          <a className="btn btn-lime" href={waLink(profile?.whatsapp, `Olá! Quero fechar a proposta de ${s.nome} para o ${lead.nome}.`)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> Quero fechar
          </a>
          <a className="btn btn-ghost" href={waLink(profile?.whatsapp, `Olá! Tenho uma dúvida sobre a proposta de ${s.nome}.`)} target="_blank" rel="noreferrer">
            <HelpCircle size={16} /> Tenho uma dúvida
          </a>
        </div>
      </div>
      <Tracker token={token} />
    </div>
  );
}
