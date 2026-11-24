import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_CATALOG_TAG } from "./tags";

const namespace = [process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public"];

/**
 * Buyers a seller sold to before the product was on BUYKUB (LINE, Facebook,
 * bank transfer), as the seller reported them. Added to the orders we can see.
 */
export const OFFLINE_BUYERS: Readonly<Record<string, number>> = {
  // ร้านชีสส์ (mysheet): 98 per course sold outside BUYKUB.
  "672f1954-3e97-4d2d-a486-28c5d3af18c0": 98, // police-support-30-days-exam-prep
  "ed29507d-cc25-4be6-9a30-745ab50c2b1a": 98, // nst-30-days-exam-prep
  "d61dbc57-6994-42f1-8bbb-34f99e8ed830": 98, // police-support-7-days-exam-prep
};

/**
 * How many different people hold a paid, unrefunded order for a product.
 * plus any buyers sold to outside BUYKUB.
 * Only the count leaves the server, never who bought.
 */
export const getProductBuyerCount = cache(unstable_cache(async (productId: string) => {
  const { data, error } = await createAdminClient().from("orders")
    .select("buyer_user_id, buyer_email")
    .eq("product_id", productId).eq("status", "paid").eq("mock", false);
  if (error) throw error;
  return countBuyers(data ?? []) + (OFFLINE_BUYERS[productId] ?? 0);
}, ["public-product-buyer-count-v2", ...namespace], { revalidate: 300, tags: [PUBLIC_CATALOG_TAG] }));

export function countBuyers(rows: Array<{ buyer_user_id: string | null; buyer_email: string | null }>) {
  const buyers = new Set<string>();
  rows.forEach((row, i) => {
    buyers.add(row.buyer_user_id ? `u:${row.buyer_user_id}` : row.buyer_email ? `e:${row.buyer_email.trim().toLowerCase()}` : `o:${i}`);
  });
  return buyers.size;
}
