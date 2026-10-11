const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlCents = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(v: number | null | undefined, cents = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return (cents ? brlCents : brl).format(v);
}

export function moneyShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return money(v);
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || name.slice(0, 2).toUpperCase();
}

/** Só dígitos, com DDI 55. Retorna null se não parecer um telefone brasileiro. */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (!d.startsWith("55")) d = `55${d}`;
  if (d.length < 12 || d.length > 13) return null;
  return d;
}

/** Link wa.me com texto. Sem número válido, abre o WhatsApp só com o texto para o vendedor escolher o contato. */
export function waLink(phone: string | null | undefined, text: string): string {
  const n = normalizeBrPhone(phone);
  const q = `text=${encodeURIComponent(text)}`;
  return n ? `https://wa.me/${n}?${q}` : `https://wa.me/?${q}`;
}
