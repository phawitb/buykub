import type { SiteSettings } from "./model";
export const ADMIN_RESPONSE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
export class AdminInputError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AdminInputError("Forbidden", 403);
  }
}
function text(value: unknown, max: number, required = false) {
  if (typeof value !== "string" || value.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (required && !value.trim())) throw new AdminInputError("ข้อความไม่ถูกต้องหรือยาวเกินกำหนด");
  return value.trim();
}
function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AdminInputError("Invalid record ID");
  return value;
}
function boolean(value: unknown) { if (typeof value !== "boolean") throw new AdminInputError("Invalid status"); return value; }
export function parseSiteSettings(body: Record<string, unknown>): SiteSettings {
  const support_email = text(body.support_email, 254);
  if (support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support_email)) throw new AdminInputError("Invalid support email");
  return { hero_title: text(body.hero_title, 160, true), hero_subtitle: text(body.hero_subtitle, 500, true), announcement: text(body.announcement, 300), support_email };
}
export function parseAdminAction(action: string, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AdminInputError("Invalid request");
  const body = raw as Record<string, unknown>;
  if (action === "save-user") return { action, userId: uuid(body.userId), note: text(body.note, 2000), payoutHold: boolean(body.payoutHold) } as const;
  if (action === "set-shop" || action === "set-product") return { action, id: uuid(body.id), published: boolean(body.published) } as const;
  if (action === "save-site") return { action, settings: parseSiteSettings(body) } as const;
  throw new AdminInputError("Unknown admin action", 404);
}
/** Bound bytes while consuming the stream; Content-Length alone is not trusted. */
export async function readAdminJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AdminInputError("Expected JSON", 415);
  if (Number(request.headers.get("content-length")) > 16000) throw new AdminInputError("Request too large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminInputError("Invalid JSON");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 16000) { await reader.cancel(); throw new AdminInputError("Request too large", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new AdminInputError("Invalid JSON"); }
}
