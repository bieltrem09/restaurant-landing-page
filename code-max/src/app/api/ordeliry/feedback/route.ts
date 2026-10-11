import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, parseJson, requireApiUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

/** 👍/👎 em cada resposta, com "o que faltou". Fica salvo para melhorar o playbook. */
export const POST = handler(async (req: Request) => {
  await requireApiUser();
  const b = await parseJson(req, z.object({ messageId: z.string().uuid(), value: z.union([z.literal(1), z.literal(-1)]), texto: z.string().max(2000).optional() }));
  const sb = await supabaseServer();
  await sb.from("ai_messages").update({ feedback: b.value, feedback_texto: b.texto ?? null }).eq("id", b.messageId);
  return NextResponse.json({ ok: true });
});
