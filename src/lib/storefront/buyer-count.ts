import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_CATALOG_TAG } from "./tags";

const namespace = [process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public"];

/**
 * How many different people hold a paid, unrefunded order for a product.
 * Only the count leaves the server, never who bought.
 */
export const getProductBuyerCount = cache(unstable_cache(async (productId: string) => {
  const { data, error } = await createAdminClient().from("orders")
    .select("buyer_user_id, buyer_email")
    .eq("product_id", productId).eq("status", "paid").eq("mock", false);
  if (error) throw error;
  return countBuyers(data ?? []);
}, ["public-product-buyer-count-v1", ...namespace], { revalidate: 300, tags: [PUBLIC_CATALOG_TAG] }));

export function countBuyers(rows: Array<{ buyer_user_id: string | null; buyer_email: string | null }>) {
  const buyers = new Set<string>();
  rows.forEach((row, i) => {
    buyers.add(row.buyer_user_id ? `u:${row.buyer_user_id}` : row.buyer_email ? `e:${row.buyer_email.trim().toLowerCase()}` : `o:${i}`);
  });
  return buyers.size;
}
