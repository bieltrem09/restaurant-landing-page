import { spDate, spParts } from "./dates";

export type Sub = { id: string; client_id: string; valor: number; dia_vencimento: number; ativa: boolean; inicio: string };
export type Pay = { subscription_id: string | null; pago_em: string };

/**
 * Situação da mensalidade no mês corrente (fuso de São Paulo):
 * paga se existe pagamento ligado à assinatura no mês; vencida se passou do dia e não pagou.
 */
export function subscriptionStatus(sub: Sub, payments: Pay[], now: Date): { status: "paga" | "vencida" | "a_vencer" | "inativa"; vencimento: Date } {
  const p = spParts(now);
  const vencimento = spDate(p.y, p.m, sub.dia_vencimento, 23, 59);
  if (!sub.ativa) return { status: "inativa", vencimento };
  const monthStart = spDate(p.y, p.m, 1);
  const monthEnd = spDate(p.y, p.m + 1, 1);
  const paid = payments.some((x) => x.subscription_id === sub.id && new Date(x.pago_em) >= monthStart && new Date(x.pago_em) < monthEnd);
  if (paid) return { status: "paga", vencimento };
  // Assinatura criada depois do vencimento deste mês só vence no próximo.
  if (new Date(`${sub.inicio}T12:00:00-03:00`) > vencimento) return { status: "a_vencer", vencimento: spDate(p.y, p.m + 1, sub.dia_vencimento, 23, 59) };
  return { status: now > vencimento ? "vencida" : "a_vencer", vencimento };
}
