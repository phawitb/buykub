import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { isReceiptId } from "@/lib/payments/receipt";
import type { CourseAccess } from "@/features/courses/model";
import type { Purchase } from "./types";

type PurchaseRow = {
  id: string;
  product_id: string;
  buyer_user_id: string | null;
  buyer_email: string;
  course_purchase: boolean;
  course_expires_at: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  price_cents: number;
  stripe_checkout_session_id: string | null;
  products: { name: string; delivery_type: string } | null;
  shops: { name: string } | null;
};

// Explicit projection excludes delivery tokens, credentials, files and payment details.
const fields = "id, product_id, buyer_user_id, buyer_email, course_purchase, course_expires_at, status, paid_at, created_at, price_cents, stripe_checkout_session_id, products(name, delivery_type), shops(name)";
const pageSize = 1000;

/** Authentication comes from getUser inside the request-scoped seller context. */
export async function getPurchaseLibrary(): Promise<Purchase[]> {
  const { user, supabase } = await getSellerContext();
  const admin = createAdminClient();
  // Never accept user_metadata.email or a caller-supplied address. eq is exact,
  // so punctuation cannot become a PostgREST filter or wildcard expression.
  const legacyEmail = user.email_confirmed_at ? user.email?.trim().toLowerCase() || null : null;

  async function readOrders(scope: "linked" | "legacy") {
    const rows: PurchaseRow[] = [];
    for (let offset = 0; ; offset += pageSize) {
      let query = admin.from("orders").select(fields);
      query = scope === "linked"
        ? query.eq("buyer_user_id", user.id)
        : query.is("buyer_user_id", null).eq("course_purchase", false).eq("buyer_email", legacyEmail!);
      const { data, error } = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + pageSize - 1);
      if (error) throw new Error("โหลดรายการที่สั่งซื้อไม่สำเร็จ");
      const batch = (data ?? []) as unknown as PurchaseRow[];
      rows.push(...batch);
      if (batch.length < pageSize) return rows;
    }
  }

  const [linked, legacy] = await Promise.all([
    readOrders("linked"),
    legacyEmail ? readOrders("legacy") : Promise.resolve([]),
  ]);
  const rows = [...linked, ...legacy].filter(row => row.buyer_user_id === user.id || (
    row.buyer_user_id === null && row.course_purchase === false && legacyEmail !== null &&
    row.buyer_email === legacyEmail && ["file", "key"].includes(row.products?.delivery_type ?? "")
  ));
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const accessChecks = new Map<string, Promise<CourseAccess | null>>();
  const now = Date.now();

  return Promise.all(rows.map(async row => {
    const kind: Purchase["kind"] = row.course_purchase ? "course"
      : row.products?.delivery_type === "file" ? "file"
      : row.products?.delivery_type === "key" ? "key" : "other";
    let status: Purchase["status"] = row.status === "paid" ? "paid"
      : row.status === "refunded" ? "refunded"
      : row.status === "pending" ? "pending"
      : row.status === "expired" ? "expired" : "unavailable";
    let href: string | null = null;
    const expiry = row.course_expires_at ? Date.parse(row.course_expires_at) : null;
    if (kind === "course" && status === "paid") {
      if (expiry !== null && (!Number.isFinite(expiry) || expiry <= now)) {
        status = "expired";
      } else if (row.paid_at && row.buyer_user_id === user.id) {
        // User-scoped RPC rechecks current entitlement; admin privileges never grant learning.
        if (!accessChecks.has(row.product_id)) {
          accessChecks.set(row.product_id, (async () => {
            const { data, error } = await supabase.rpc("course_access", { p_product_id: row.product_id });
            if (error) throw new Error("ตรวจสอบสิทธิ์เข้าเรียนไม่สำเร็จ");
            return data as CourseAccess | null;
          })());
        }
        const access = await accessChecks.get(row.product_id);
        if (access?.allowed === true) href = `/learn/${encodeURIComponent(row.product_id)}`;
        else status = access?.reason === "expired" ? "expired" : access?.reason === "refunded" ? "refunded" : "unavailable";
      } else status = "unavailable";
    } else if ((kind === "file" || kind === "key") && status === "paid" && isReceiptId(row.stripe_checkout_session_id)) {
      // Existing receipt/delivery endpoints recheck payment and refunds on every access.
      href = `/checkout/success?session_id=${encodeURIComponent(row.stripe_checkout_session_id)}`;
    }
    return {
      id: row.id,
      name: row.products?.name ?? "สินค้าที่ไม่พร้อมแสดง",
      shopName: row.shops?.name ?? "ร้านค้า",
      kind,
      priceCents: row.price_cents,
      purchasedAt: row.created_at,
      status,
      expiresAt: kind === "course" ? row.course_expires_at : null,
      href,
    };
  }));
}
