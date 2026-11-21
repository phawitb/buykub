import "server-only";
import { normalizeTokenUsage, type AgentModelId, type TokenUsage } from "@/lib/agent/pricing";

const API_URL = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 60_000;

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompletion = {
  content: string;
  usage: TokenUsage;
};

export function isAgentConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

/**
 * One DeepSeek call. `effort: "low"` keeps reasoning tokens down, which is
 * what most of a cheap model's bill is made of.
 */
export async function completeChat(options: {
  model: AgentModelId;
  messages: readonly ChatMessage[];
  maxTokens: number;
  jsonObject?: boolean;
}): Promise<ChatCompletion> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AgentError("ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY บนเซิร์ฟเวอร์", 503);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        effort: "low",
        temperature: 0.2,
        max_tokens: options.maxTokens,
        messages: options.messages,
        ...(options.jsonObject ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new AgentError(
      timedOut ? "AI ใช้เวลานานเกินไป กรุณาลองอีกครั้ง" : "เชื่อมต่อ AI ไม่สำเร็จ กรุณาลองอีกครั้ง",
      504,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
    usage?: unknown;
    error?: { message?: unknown; type?: unknown };
  } | null;

  if (!response.ok) {
    const type = typeof payload?.error?.type === "string" ? payload.error.type : "";
    if (response.status === 402 || type === "insufficient_balance_error") {
      throw new AgentError("เครดิต AI ของระบบหมด กรุณาแจ้งผู้ดูแลระบบ", 503);
    }
    if (response.status === 429) {
      throw new AgentError("AI กำลังมีคำขอหนาแน่น กรุณาลองอีกครั้งในอีกสักครู่", 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new AgentError("การตั้งค่า AI ของระบบไม่ถูกต้อง กรุณาแจ้งผู้ดูแลระบบ", 503);
    }
    throw new AgentError("AI ตอบกลับไม่สำเร็จ กรุณาลองอีกครั้ง", 502);
  }

  const choice = payload?.choices?.[0];
  // The reasoning tokens come out of the same budget as the answer, so a model
  // that thinks its way to the ceiling returns a truncated reply — or, as
  // measured on a dense ten-page document, no reply at all. Whatever came back
  // cannot be parsed, and saying so beats failing as if the service were down.
  if (choice?.finish_reason === "length") {
    throw new AgentError("AI ร่างข้อมูลไม่จบ กรุณาลองอีกครั้ง", 502);
  }

  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AgentError("AI ไม่ได้ส่งเนื้อหากลับมา กรุณาลองอีกครั้ง", 502);
  }

  return { content, usage: normalizeTokenUsage(payload?.usage) };
}
