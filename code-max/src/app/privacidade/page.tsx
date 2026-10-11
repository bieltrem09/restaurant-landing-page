import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidade" };

export default function Privacidade() {
  return (
    <div className="public">
      <div className="public-inner">
        <span className="eyebrow">Code Max · Privacidade e LGPD</span>
        <h1>Como tratamos dados</h1>
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}>
            <b>Quais dados.</b> Coletamos apenas dados públicos de empresas: nome, endereço, telefone comercial, site, nota e número de avaliações no Google, e
            métricas públicas do site (Google PageSpeed Insights, HTTPS, conteúdo público da página). Não coletamos dados de pessoas físicas consumidoras.
          </p>
          <p style={{ margin: 0 }}>
            <b>Base legal.</b> Legítimo interesse (art. 7º, IX da LGPD) para prospecção comercial entre empresas (B2B), com contato feito manualmente pelo
            vendedor e possibilidade de oposição a qualquer momento.
          </p>
          <p style={{ margin: 0 }}>
            <b>Não contatar.</b> Qualquer empresa pode pedir para não ser contatada. O pedido é registrado e a empresa não volta a aparecer em buscas futuras do
            vendedor (por identificador do Google e por telefone).
          </p>
          <p style={{ margin: 0 }}>
            <b>Rastreamento.</b> Páginas de diagnóstico, proposta e sites de exemplo registram apenas abertura, tempo na página, rolagem até o fim e clique no
            WhatsApp, associados ao token da página. Não registramos IP, nome ou qualquer dado pessoal do visitante.
          </p>
          <p style={{ margin: 0 }}>
            <b>Retenção.</b> Dados do Google ficam em cache por até 30 dias e são revalidados periodicamente. Para pedir exclusão, fale com o vendedor que entrou em
            contato com você.
          </p>
        </section>
      </div>
    </div>
  );
}
