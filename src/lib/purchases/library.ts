import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { isReceiptId } from "@/lib/payments/receipt";
import type { CourseAccess } from "@/features/courses/model";
import { readExamSummary } from "@/features/courses/exam-prep/pack";
import type { Purchase, PurchaseProgress, PurchaseReferral, ShopTryout } from "./types";

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
  products: { name: string; delivery_type: string; file_path: string | null; images: unknown; images_v2: unknown } | null;
  shops: { name: string; slug: string; published: boolean } | null;
};

// Explicit projection excludes delivery tokens, credentials and payment details;
// file_path only decides whether a PDF button exists and never leaves the server.
const fields = "id, product_id, buyer_user_id, buyer_email, course_purchase, course_expires_at, status, paid_at, created_at, price_cents, stripe_checkout_session_id, products(name, delivery_type, file_path, images, images_v2), shops(name, slug, published)";
const pageSize = 1000;

/** The first public product image, newest image list first. */
function coverOf(product: { images: unknown; images_v2: unknown } | null | undefined) {
  const imagesV2 = Array.isArray(product?.images_v2) ? product.images_v2 as Array<{ publicUrl?: string }> : [];
  const legacy = Array.isArray(product?.images) ? product.images as string[] : [];
  return imagesV2[0]?.publicUrl ?? legacy[0] ?? null;
}

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

  const purchases = await Promise.all(rows.map(async row => {
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
      shopHref: row.shops?.published && row.shops.slug ? `/${encodeURIComponent(row.shops.slug)}` : null,
      kind,
      priceCents: row.price_cents,
      purchasedAt: row.created_at,
      status,
      expiresAt: kind === "course" ? row.course_expires_at : null,
      href,
      coverUrl: coverOf(row.products),
      ...(kind === "course" ? { pdfHref: href && row.products?.file_path ? `/learn/${encodeURIComponent(row.product_id)}/pdf` : null } : {}),
      productId: row.product_id,
    };
  }));
  const open = purchases.filter(purchase => purchase.kind === "course" && purchase.href).map(purchase => purchase.productId);
  // Only a still-paid purchase bound to this account can refer; the database checks again.
  const referrers = rows.filter(row => row.status === "paid" && row.buyer_user_id === user.id).map(row => row.product_id);
  const [progress, referralRates] = await Promise.all([
    readExamProgress(admin, user.id, [...new Set(open)]).catch(() => new Map<string, PurchaseProgress>()),
    readReferralRates(admin, [...new Set(referrers)]).catch(() => new Map<string, { rateBp: number; priceCents: number }>()),
  ]);
  const referable = new Set(referrers);
  return purchases.map(({ productId, ...purchase }) => {
    const answered = purchase.href ? progress.get(productId) : undefined;
    const rate = purchase.status === "paid" && referable.has(productId) ? referralRates.get(productId) : undefined;
    const referral: PurchaseReferral | null = rate ? { productId, ...rate } : null;
    return { ...purchase, ...(answered ? { progress: answered } : {}), ...(referral ? { referral } : {}) };
  });
}

/**
 * Products of the seller's own shop, so they can try each one as a buyer would.
 * Courses open through course_access, which already lets the owner in; files use
 * the owner-only download route; keys stay in the dashboard, since opening one
 * would hand out real stock.
 */
export async function getShopTryouts(): Promise<ShopTryout[]> {
  const { user, supabase, shop } = await getSellerContext();
  if (!shop) return [];
  // The user-scoped client reads through RLS; file_path stays on the server.
  const { data, error } = await supabase.from("products").select("id, name, delivery_type, file_path, published, images, images_v2")
    .eq("shop_id", shop.id).order("position", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
  if (error) throw new Error("โหลดสินค้าของร้านไม่สำเร็จ");
  const tryouts = (data ?? []).flatMap((row): ShopTryout[] => {
    const id = encodeURIComponent(row.id);
    const base = { id: row.id as string, name: row.name as string, published: row.published === true, coverUrl: coverOf(row) };
    if (row.delivery_type === "course") return [{ ...base, kind: "course", href: `/learn/${id}`, pdfHref: row.file_path ? `/learn/${id}/pdf` : null }];
    if (row.delivery_type === "file") return [{ ...base, kind: "file", href: row.file_path ? `/api/products/${id}/file` : null }];
    if (row.delivery_type === "key") return [{ ...base, kind: "key", href: `/dashboard/products/${id}/edit` }];
    return [];
  });
  const courses = tryouts.filter(tryout => tryout.kind === "course").map(tryout => tryout.id);
  const progress = await readExamProgress(createAdminClient(), user.id, courses).catch(() => new Map<string, PurchaseProgress>());
  return tryouts.map(tryout => progress.has(tryout.id) ? { ...tryout, progress: progress.get(tryout.id) } : tryout);
}

/** Referral rates of published products in published shops. Best effort, like progress. */
async function readReferralRates(admin: ReturnType<typeof createAdminClient>, productIds: string[]) {
  const rates = new Map<string, { rateBp: number; priceCents: number }>();
  if (!productIds.length) return rates;
  const { data, error } = await admin.from("products").select("id, affiliate_rate_bp, price_cents, published, shops(published)")
    .in("id", productIds).not("affiliate_rate_bp", "is", null);
  if (error) return rates;
  for (const row of (data ?? []) as unknown as { id: string; affiliate_rate_bp: number; price_cents: number; published: boolean; shops: { published: boolean } | null }[]) {
    if (row.published && row.shops?.published) rates.set(row.id, { rateBp: row.affiliate_rate_bp, priceCents: row.price_cents });
  }
  return rates;
}

/** Questions attempted in each open exam-prep course. Best effort: the library never fails over it. */
async function readExamProgress(admin: ReturnType<typeof createAdminClient>, userId: string, productIds: string[]) {
  const progress = new Map<string, PurchaseProgress>();
  if (!productIds.length) return progress;
  const [products, saved] = await Promise.all([
    admin.from("products").select("id, course_format, exam_summary").in("id", productIds),
    admin.from("course_progress").select("product_id, state").eq("user_id", userId).in("product_id", productIds),
  ]);
  if (products.error || saved.error) return progress;
  const states = new Map((saved.data ?? []).map(row => [row.product_id as string, row.state as { att?: Record<string, unknown> } | null]));
  for (const product of products.data ?? []) {
    const summary = product.course_format === "exam_prep" ? readExamSummary(product.exam_summary) : null;
    if (!summary) continue;
    const attempts = states.get(product.id)?.att;
    progress.set(product.id, { answered: attempts && typeof attempts === "object" ? Object.keys(attempts).length : 0, total: summary.questions });
  }
  return progress;
}
