import { isGoogleUser } from "@/lib/auth";
import { AgentError, completeChat } from "@/lib/agent/deepseek";
import {
  buildDraftMessages,
  normalizeDraftPages,
  normalizeDraftSource,
  parseProductDraft,
} from "@/lib/agent/draft";
import type { ProductDraftResponse } from "@/lib/agent/model";
import { DEFAULT_AGENT_MODEL, usageCostMicros } from "@/lib/agent/pricing";
import { hasAllowance, limitReachedMessage, readAllowance, recordUsage } from "@/lib/agent/usage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const RESPONSE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
/** Ten pages of Thai text, plus JSON overhead. */
const MAX_REQUEST_BYTES = 200_000;
const MAX_COMPLETION_TOKENS = 2000;

class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function assertSameOrigin(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new RequestError("Forbidden", 403);
  }
}

/** Bounds bytes while consuming the stream; Content-Length alone is not trusted. */
async function readJson(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  ) {
    throw new RequestError("Expected JSON", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    throw new RequestError("ข้อความจาก PDF ยาวเกินกำหนด", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Invalid JSON", 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RequestError("ข้อความจาก PDF ยาวเกินกำหนด", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestError("Invalid JSON", 400);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new RequestError("Invalid request", 400);
    }
    const payload = body as Record<string, unknown>;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new RequestError("กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง", 401);
    if (!isGoogleUser(user)) throw new RequestError("Forbidden", 403);

    const pages = normalizeDraftPages(payload.pages);
    const textSource = normalizeDraftSource(payload.textSource);
    if (!pages.length) {
      // The browser already tried reading the text layer and then recognizing
      // the page images, so there is nothing left for the agent to work from.
      throw new RequestError(
        "อ่านข้อความจากไฟล์ PDF นี้ไม่ได้ แม้จะลองอ่านตัวอักษรจากรูปแล้ว กรุณากรอกข้อมูลเอง",
        422,
      );
    }
    const fileName =
      typeof payload.fileName === "string"
        ? payload.fileName.replace(/[\r\n]+/g, " ").trim().slice(0, 160)
        : "product.pdf";

    const allowance = await readAllowance(user.id);
    if (!hasAllowance(allowance)) {
      return Response.json(
        { error: limitReachedMessage(allowance), allowance },
        { status: 429, headers: RESPONSE_HEADERS },
      );
    }

    const model = DEFAULT_AGENT_MODEL;
    const completion = await completeChat({
      model,
      messages: buildDraftMessages(pages, fileName, textSource),
      maxTokens: MAX_COMPLETION_TOKENS,
      jsonObject: true,
    });

    const costMicros = usageCostMicros(model, completion.usage, new Date());
    const nextAllowance = await recordUsage({
      userId: user.id,
      operation: textSource === "ocr" ? "product-draft-ocr" : "product-draft",
      model,
      usage: completion.usage,
      costMicros,
      limitMicros: allowance.limitMicros,
    });

    const response: ProductDraftResponse = {
      draft: parseProductDraft(completion.content),
      usage: {
        model,
        promptTokens: completion.usage.promptTokens,
        cachedTokens: completion.usage.cachedTokens,
        completionTokens: completion.usage.completionTokens,
        costMicros,
      },
      allowance: nextAllowance,
      pagesRead: pages.length,
      textSource,
    };
    return Response.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const status =
      error instanceof RequestError || error instanceof AgentError ? error.status : 503;
    const message =
      error instanceof RequestError || error instanceof AgentError
        ? error.message
        : "ระบบ AI ไม่พร้อมใช้งาน กรุณากรอกข้อมูลเอง";
    return Response.json({ error: message }, { status, headers: RESPONSE_HEADERS });
  }
}

export function GET() {
  return Response.json(
    { error: "Method not allowed" },
    { status: 405, headers: { ...RESPONSE_HEADERS, Allow: "POST" } },
  );
}
