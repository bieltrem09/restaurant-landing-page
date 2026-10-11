import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer, requireUser } from "./supabase/server";
import type { Deal, Interaction, Lead, LeadSignal, PlaybookEntry, PortfolioItem, Profile, Service, Task } from "./types";

export const getProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data, error } = await sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  // Tabela inexistente: a migração ainda não foi rodada no Supabase.
  if (error && (error.code === "PGRST205" || error.code === "42P01")) redirect("/configuracao?banco=1");
  if (data) return data as Profile;
  // Perfil ainda não criado (trigger ausente): cria vazio.
  const { data: created } = await sb.from("profiles").insert({ user_id: user.id }).select("*").single();
  return created as Profile;
});

export async function getServices(sb?: SupabaseClient): Promise<Service[]> {
  const c = sb ?? (await supabaseServer());
  const { data } = await c.from("services").select("*").order("criado_em");
  return (data ?? []) as Service[];
}

export async function getPortfolio(sb?: SupabaseClient): Promise<PortfolioItem[]> {
  const c = sb ?? (await supabaseServer());
  const { data } = await c.from("portfolio_items").select("*").order("criado_em");
  return (data ?? []) as PortfolioItem[];
}

export async function getPlaybook(sb?: SupabaseClient): Promise<PlaybookEntry[]> {
  const c = sb ?? (await supabaseServer());
  const { data } = await c.from("playbook_entries").select("*").order("criado_em");
  return (data ?? []) as PlaybookEntry[];
}

export type LeadDetail = Lead & {
  signals: LeadSignal[];
  deal: Deal | null;
  interactions: Interaction[];
  tasks: Task[];
  pacote: Service | null;
  views: { total: number; ultimo: string | null; porTipo: Record<string, number> };
  trackers: Array<{ id: string; token: string; tipo: string; url: string | null }>;
};

export async function getLeadDetail(sb: SupabaseClient, id: string): Promise<LeadDetail | null> {
  const { data: lead } = await sb.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) return null;
  const [signals, deal, interactions, tasks, trackers, events] = await Promise.all([
    sb.from("lead_signals").select("*").eq("lead_id", id).order("pontos", { ascending: false }),
    sb.from("deals").select("*").eq("lead_id", id).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    sb.from("interactions").select("*").eq("lead_id", id).order("ocorreu_em"),
    sb.from("tasks").select("*").eq("lead_id", id).order("vence_em"),
    sb.from("trackers").select("id, token, tipo, url").eq("lead_id", id),
    sb.from("track_events").select("evento, ocorreu_em, tracker_id").eq("lead_id", id).eq("evento", "open").order("ocorreu_em", { ascending: false }),
  ]);
  let pacote: Service | null = null;
  if (lead.pacote_sugerido_id) {
    const { data } = await sb.from("services").select("*").eq("id", lead.pacote_sugerido_id).maybeSingle();
    pacote = (data as Service) ?? null;
  }
  const trackerTipo = new Map((trackers.data ?? []).map((t) => [t.id, t.tipo as string]));
  const porTipo: Record<string, number> = {};
  for (const e of events.data ?? []) {
    const t = trackerTipo.get(e.tracker_id) ?? "outro";
    porTipo[t] = (porTipo[t] ?? 0) + 1;
  }
  return {
    ...(lead as Lead),
    signals: (signals.data ?? []) as LeadSignal[],
    deal: (deal.data as Deal) ?? null,
    interactions: (interactions.data ?? []) as Interaction[],
    tasks: (tasks.data ?? []) as Task[],
    pacote,
    views: { total: events.data?.length ?? 0, ultimo: events.data?.[0]?.ocorreu_em ?? null, porTipo },
    trackers: (trackers.data ?? []) as LeadDetail["trackers"],
  };
}

/** Lista de place_ids e telefones marcados como "não contatar". */
export async function getDoNotContact(sb: SupabaseClient) {
  const { data } = await sb.from("do_not_contact").select("place_id, telefone");
  return {
    places: new Set((data ?? []).map((d) => d.place_id).filter(Boolean) as string[]),
    phones: new Set((data ?? []).map((d) => (d.telefone ?? "").replace(/\D/g, "")).filter(Boolean)),
  };
}

export async function logActivity(sb: SupabaseClient, userId: string, tipo: string, texto: string, leadId?: string | null) {
  await sb.from("activity").insert({ user_id: userId, tipo, texto, lead_id: leadId ?? null });
}
