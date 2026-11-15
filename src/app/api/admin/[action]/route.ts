import { revalidateTag } from "next/cache";
import { AdminAccessError } from "@/lib/admin/access";
import { applyAdminAction } from "@/lib/admin/service";
import { ADMIN_RESPONSE_HEADERS, AdminInputError, assertSameOrigin, readAdminJson } from "@/lib/admin/validation";
import { PUBLIC_CATALOG_TAG } from "@/lib/storefront/tags";
import { PUBLIC_SITE_SETTINGS_TAG } from "@/lib/admin/site";
import { applyPayoutAction } from "@/lib/admin/payout-actions";
import { PayoutError } from "@/lib/payouts/errors";
import { AgentAdminInputError, applyAgentAdminAction } from "@/lib/agent/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    assertSameOrigin(request);
    const body = await readAdminJson(request);
    const { action } = await context.params;
    if (action.startsWith("payout-")) return Response.json(await applyPayoutAction(action, body), { headers: ADMIN_RESPONSE_HEADERS });
    if (action.startsWith("agent-")) {
      await applyAgentAdminAction(action, body);
      return Response.json({ ok: true }, { headers: ADMIN_RESPONSE_HEADERS });
    }
    const applied = await applyAdminAction(action, body);
    if (applied === "set-shop" || applied === "set-product") revalidateTag(PUBLIC_CATALOG_TAG, { expire: 0 });
    if (applied === "save-site") revalidateTag(PUBLIC_SITE_SETTINGS_TAG, { expire: 0 });
    return Response.json({ ok: true }, { headers: ADMIN_RESPONSE_HEADERS });
  } catch (error) {
    const status = error instanceof AdminAccessError || error instanceof AdminInputError || error instanceof AgentAdminInputError ? error.status : error instanceof PayoutError ? 409 : 503;
    return Response.json({ error: status === 503 ? "ไม่สามารถบันทึกได้ กรุณาลองอีกครั้ง" : error instanceof Error ? error.message : "Request failed" }, { status, headers: ADMIN_RESPONSE_HEADERS });
  }
}
export function GET() { return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...ADMIN_RESPONSE_HEADERS, Allow: "POST" } }); }
