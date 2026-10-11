import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  return new Anthropic();
}

export function ordeliryModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

// Modelos que aceitam o fallback automático do servidor em caso de recusa ("default").
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

/** Parâmetros extras de fallback em caso de recusa por classificador de segurança. */
export function fallbackParams(model: string): { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: "default" } {
  return FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
}

export function isToolJsonError(e: unknown): boolean {
  return e instanceof Anthropic.AnthropicError && !(e instanceof Anthropic.APIError) && e.message.startsWith("Unable to parse tool parameter JSON");
}

export function friendlyApiError(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "A Ordeliry está com muitas requisições agora. Tente de novo em instantes.";
  if (e instanceof Anthropic.AuthenticationError) return "Chave da API da Anthropic inválida. Confira ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.BadRequestError) return `Requisição recusada pela API: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `Erro da API (${e.status}). Tente novamente.`;
  if (e instanceof Error) return e.message;
  return "Erro inesperado.";
}
