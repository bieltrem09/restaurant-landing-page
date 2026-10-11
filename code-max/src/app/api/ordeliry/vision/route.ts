import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handler, parseJson, rateLimit, requireApiUser } from "@/lib/api";
import { anthropic, friendlyApiError, ordeliryModel } from "@/lib/ordeliry/client";
import { recordUsage } from "@/lib/radar";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

const Transcription = z.object({
  mensagens: z.array(
    z.object({
      quem: z.enum(["vendedor", "cliente"]).describe("vendedor = balões do dono do celular (à direita, geralmente verdes); cliente = balões à esquerda"),
      autor: z.string().describe("nome exibido, se aparecer; senão 'Vendedor' ou 'Cliente'"),
      hora: z.string().describe("hora exibida no balão no formato HH:MM, ou string vazia"),
      texto: z.string().describe("texto exato do balão; para áudio escreva [áudio de M:SS]; para imagem [imagem]"),
    }),
  ),
  data_visivel: z.string().describe("data exibida no topo do print (dd/mm/aaaa), ou string vazia"),
  observacoes: z.string().describe("trechos ilegíveis ou cortados; string vazia se nada"),
});

const bodySchema = z.object({
  images: z.array(z.object({ media_type: z.enum(["image/png", "image/jpeg", "image/webp"]), data: z.string().max(7_000_000) })).min(1).max(8),
});

/** Lê prints do WhatsApp e devolve a transcrição estruturada (quem disse o quê). Não grava nada: o vendedor revisa antes. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`vision:${user.id}`, 10, 60_000);
  const { images } = await parseJson(req, bodySchema);
  try {
    const res = await anthropic().messages.parse({
      model: ordeliryModel(),
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(Transcription), effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            ...images.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.media_type, data: i.data } })),
            {
              type: "text" as const,
              text: "Transcreva estes prints de conversa do WhatsApp, na ordem (os prints estão em sequência). Não resuma, não corrija o português, não invente nada que não esteja visível. Ignore a barra de status do celular.",
            },
          ],
        },
      ],
    });
    const sb = await supabaseServer();
    await recordUsage(sb, user.id, "anthropic", 1);
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new ApiError(422, "Não foi possível ler os prints. Tente imagens mais nítidas.");
    return NextResponse.json(res.parsed_output);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, friendlyApiError(e));
  }
});
