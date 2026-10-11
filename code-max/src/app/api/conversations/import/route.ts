import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handler, parseJson, rateLimit, requireApiUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { authorsOf, parseWhatsAppExport, toInteractions } from "@/lib/whatsapp-parser";

const schema = z.object({
  leadId: z.string().uuid(),
  raw: z.string().min(1).max(500_000),
  /** Nome do vendedor como aparece no export. Sem ele, só devolvemos a prévia. */
  vendedor: z.string().optional(),
  confirmar: z.boolean().default(false),
});

/** Parser do export do WhatsApp. Primeiro devolve a prévia (autores e mensagens); com confirmar=true grava. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`import:${user.id}`, 20, 60_000);
  const b = await parseJson(req, schema);
  const msgs = parseWhatsAppExport(b.raw);
  if (!msgs.length) throw new ApiError(422, "Não reconheci o formato. Exporte a conversa no WhatsApp (Mais > Exportar conversa > Sem mídia) e cole o texto.");
  const autores = authorsOf(msgs);
  if (!b.confirmar || !b.vendedor) return NextResponse.json({ autores, total: msgs.length, preview: msgs.slice(0, 8) });
  if (!autores.includes(b.vendedor)) throw new ApiError(400, "O vendedor indicado não aparece na conversa.");
  const sb = await supabaseServer();
  const rows = toInteractions(msgs, b.vendedor).map((r) => ({ ...r, user_id: user.id, lead_id: b.leadId }));
  const { error } = await sb.from("interactions").insert(rows);
  if (error) throw new ApiError(500, "Falha ao salvar a conversa.");
  const ultimaEnviada = rows.filter((r) => r.tipo === "mensagem_enviada").at(-1);
  if (ultimaEnviada) await sb.from("leads").update({ ultimo_contato_em: ultimaEnviada.ocorreu_em }).eq("id", b.leadId);
  return NextResponse.json({ salvas: rows.length });
});
