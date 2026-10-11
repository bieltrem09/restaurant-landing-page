import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

const schema = z.object({
  k: z.string().regex(/^[a-f0-9]{24}$/),
  e: z.enum(["open", "scroll_end", "click_whatsapp", "heartbeat"]),
  p: z.string().max(300).optional(),
  d: z.number().int().min(0).max(86_400).optional(),
});

// Rate limit por token (por instância): 120 eventos/min.
const hits = new Map<string, number[]>();
function limited(token: string): boolean {
  const now = Date.now();
  const arr = (hits.get(token) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(token, arr);
  return arr.length > 120;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (/bot|crawl|spider|preview|headless/i.test(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204, headers: CORS });
  let raw: unknown;
  try {
    raw = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }
  const r = schema.safeParse(raw);
  if (!r.success) return new Response(null, { status: 400, headers: CORS });
  if (limited(r.data.k)) return new Response(null, { status: 429, headers: CORS });
  // Cookie de exclusão do vendedor (definido ao abrir o app).
  if (req.headers.get("cookie")?.includes("cm_excluir=1")) return new Response(null, { status: 204, headers: CORS });

  const sb = supabaseAdmin();
  const { data: tracker } = await sb.from("trackers").select("id, user_id, lead_id, tipo").eq("token", r.data.k).maybeSingle();
  if (!tracker) return new Response(null, { status: 404, headers: CORS });
  await sb.from("track_events").insert({
    user_id: tracker.user_id,
    tracker_id: tracker.id,
    lead_id: tracker.lead_id,
    evento: r.data.e,
    pagina: r.data.p ?? null,
    duracao_s: r.data.d ?? null,
  });
  if (r.data.e === "open" || r.data.e === "click_whatsapp") {
    const { data: lead } = await sb.from("leads").select("nome").eq("id", tracker.lead_id).single();
    const { count } = await sb.from("track_events").select("id", { count: "exact", head: true }).eq("tracker_id", tracker.id).eq("evento", "open");
    const alvo = { exemplo: "o site de exemplo", diagnostico: "o diagnóstico", proposta: "a proposta" }[tracker.tipo as string] ?? "a página";
    const texto =
      r.data.e === "open"
        ? `${lead?.nome ?? "Lead"} abriu ${alvo}${count && count > 1 ? ` pela ${count}ª vez` : ""}`
        : `${lead?.nome ?? "Lead"} clicou no WhatsApp em ${alvo}`;
    await sb.from("activity").insert({ user_id: tracker.user_id, lead_id: tracker.lead_id, tipo: "presenca", texto });
  }
  return new Response(null, { status: 204, headers: CORS });
}
