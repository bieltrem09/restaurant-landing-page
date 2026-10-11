import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ApiError, handler, parseJson, rateLimit, requireApiUser } from "@/lib/api";
import { MODES, type Mode } from "@/lib/ordeliry/context";
import { anthropic, fallbackParams, friendlyApiError, isToolJsonError, ordeliryModel } from "@/lib/ordeliry/client";
import { loadSystemPrompt } from "@/lib/ordeliry/load-context";
import { describeAction, READ_ONLY, runTool, TOOL_SCHEMAS, TOOLS, type ToolName } from "@/lib/ordeliry/tools";
import { recordUsage } from "@/lib/radar";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 120;

type Block = Anthropic.Beta.BetaContentBlockParam;
type Msg = Anthropic.Beta.BetaMessageParam;

const bodySchema = z.object({
  threadId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  mode: z.enum(Object.keys(MODES) as [Mode, ...Mode[]]).default("auto"),
  text: z.string().max(30_000).optional().nullable(),
  images: z
    .array(z.object({ media_type: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]), data: z.string().max(7_000_000) }))
    .max(6)
    .optional(),
  decisions: z.array(z.object({ tool_use_id: z.string(), approve: z.boolean() })).optional(),
  simulador: z.object({ nicho: z.string(), dificuldade: z.enum(["facil", "media", "dificil"]) }).optional(),
});

const MAX_ITERATIONS = 6;

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  rateLimit(`ordeliry:${user.id}`, 30, 60_000);
  const body = await parseJson(req, bodySchema);
  if (!body.text?.trim() && !body.images?.length && !body.decisions?.length) throw new ApiError(400, "Escreva uma mensagem.");
  const sb = await supabaseServer();
  const client = anthropic();
  const model = ordeliryModel();

  // Thread
  let threadId = body.threadId ?? null;
  let leadId = body.leadId ?? null;
  if (threadId) {
    const { data: t } = await sb.from("ai_threads").select("id, lead_id").eq("id", threadId).maybeSingle();
    if (!t) throw new ApiError(404, "Conversa não encontrada.");
    leadId = t.lead_id ?? leadId;
  } else {
    const titulo = (body.text ?? "Análise de print").trim().slice(0, 80) || "Nova conversa";
    const { data: t } = await sb.from("ai_threads").insert({ user_id: user.id, lead_id: leadId, modo: body.mode, titulo }).select("id").single();
    if (!t) throw new ApiError(500, "Não foi possível criar a conversa.");
    threadId = t.id as string;
  }

  const { data: rows } = await sb.from("ai_messages").select("role, conteudo").eq("thread_id", threadId).order("criado_em");
  const history: Msg[] = (rows ?? []).map((r) => ({ role: r.role as "user" | "assistant", content: r.conteudo as Block[] }));
  const { data: profile } = await sb.from("profiles").select("nome").eq("user_id", user.id).single();
  const vendedor = profile?.nome ?? "";

  async function save(role: "user" | "assistant", content: Block[], tokens?: number) {
    const { data } = await sb.from("ai_messages").insert({ user_id: user.id, thread_id: threadId, role, conteudo: content, tokens: tokens ?? null }).select("id").single();
    history.push({ role, content });
    return data?.id as string | undefined;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        send({ type: "thread", id: threadId });

        // 1) Responde tool_use pendentes da última resposta (confirmadas, recusadas ou ignoradas).
        const last = history.at(-1);
        const userBlocks: Block[] = [];
        if (last?.role === "assistant" && Array.isArray(last.content)) {
          const pending = (last.content as Block[]).filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use");
          for (const tu of pending) {
            const name = tu.name as ToolName;
            const decision = body.decisions?.find((d) => d.tool_use_id === tu.id);
            const parsed = TOOL_SCHEMAS[name]?.safeParse(tu.input);
            let content: string;
            let isError = false;
            if (!parsed?.success) {
              content = JSON.stringify({ INVALID_JSON: JSON.stringify(tu.input) });
              isError = true;
            } else if (READ_ONLY.has(name) || decision?.approve) {
              try {
                content = await runTool(sb, user.id, vendedor, name, parsed.data as Record<string, unknown>);
                if (!READ_ONLY.has(name)) send({ type: "action_done", tool_use_id: tu.id, name, result: content });
              } catch (e) {
                content = `Falhou: ${e instanceof Error ? e.message : "erro"}`;
                isError = true;
              }
            } else {
              content = decision ? "O vendedor recusou esta ação." : "O vendedor não confirmou esta ação e seguiu a conversa.";
            }
            userBlocks.push({ type: "tool_result", tool_use_id: tu.id, content, ...(isError ? { is_error: true } : {}) });
          }
        }
        for (const img of body.images ?? []) userBlocks.push({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } });
        if (body.text?.trim()) userBlocks.push({ type: "text", text: body.mode !== "auto" ? `[Modo: ${MODES[body.mode]}]\n${body.text.trim()}` : body.text.trim() });
        if (!userBlocks.length) throw new Error("Nada para enviar.");
        await save("user", userBlocks);

        const system = await loadSystemPrompt(sb, user.id, { leadId, mode: body.mode, simulador: body.simulador });
        let outputTokens = 0;

        // 2) Loop: streaming; ferramentas de leitura rodam aqui; as de escrita voltam para confirmação.
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          let final: Anthropic.Beta.BetaMessage | null = null;
          for (let attempt = 0; attempt < 2 && !final; attempt++) {
            try {
              const s = client.beta.messages.stream({
                model,
                max_tokens: 16000,
                system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
                tools: TOOLS,
                messages: history,
                output_config: { effort: "medium" },
                ...fallbackParams(model),
              });
              for await (const ev of s) {
                if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") send({ type: "text", delta: ev.delta.text });
                if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") send({ type: "tool_status", name: ev.content_block.name });
              }
              final = await s.finalMessage();
            } catch (e) {
              if (!isToolJsonError(e) || attempt === 1) throw e;
              send({ type: "retry" });
            }
          }
          if (!final) break;
          outputTokens += final.usage.output_tokens;
          const assistantId = await save("assistant", final.content as Block[], final.usage.output_tokens);
          send({ type: "message", id: assistantId });

          if (final.stop_reason === "refusal") {
            send({ type: "notice", message: "A Ordeliry não pôde responder a este pedido." });
            break;
          }
          const toolUses = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (final.stop_reason === "max_tokens" && toolUses.length) {
            send({ type: "notice", message: "A resposta foi cortada antes de terminar a ação. Peça de novo." });
            break;
          }
          if (final.stop_reason !== "tool_use" || !toolUses.length) break;

          const needsConfirm = toolUses.filter((t) => !READ_ONLY.has(t.name as ToolName));
          if (needsConfirm.length) {
            send({
              type: "pending",
              actions: needsConfirm.map((t) => ({ id: t.id, name: t.name, input: t.input, descricao: describeAction(t.name as ToolName, t.input as Record<string, unknown>) })),
            });
            break;
          }
          const results: Block[] = [];
          for (const t of toolUses) {
            const parsed = TOOL_SCHEMAS[t.name as ToolName]?.safeParse(t.input);
            if (!parsed?.success) {
              results.push({ type: "tool_result", tool_use_id: t.id, is_error: true, content: JSON.stringify({ INVALID_JSON: JSON.stringify(t.input) }) });
              continue;
            }
            const content = await runTool(sb, user.id, vendedor, t.name as ToolName, parsed.data as Record<string, unknown>);
            results.push({ type: "tool_result", tool_use_id: t.id, content });
          }
          await save("user", results);
        }
        await sb.from("ai_threads").update({ atualizado_em: new Date().toISOString() }).eq("id", threadId);
        await recordUsage(sb, user.id, "anthropic", 1);
        send({ type: "done", outputTokens });
      } catch (e) {
        send({ type: "error", message: friendlyApiError(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
});
