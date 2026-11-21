import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { isMissingColumnError } from "@/lib/supabase/missing-column";

import { PUBLIC_CATALOG_TAG } from "./tags";
const options = { revalidate: 60, tags: [PUBLIC_CATALOG_TAG] };
const namespace = [process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public"];

// Only anonymous, published catalog data enters this cross-request cache.
// Payment, stock, identity, and course access checks must remain outside it.
export const getPublicShop = cache(unstable_cache(async (slug: string) => {
  const { data, error } = await createPublicClient().from("shops")
    .select("id, slug, name, bio, avatar_url, cover_url, accent_color")
    .eq("slug", slug).eq("published", true).maybeSingle();
  if (error) throw error;
  return data;
}, ["public-shop-v1", ...namespace], options));

export const getPublicProduct = cache(unstable_cache(async (shopId: string, slug: string) => {
  const { data, error } = await createPublicClient().from("products")
    .select("id, shop_id, slug, name, description, description_html, category, price_cents, compare_price_cents, highlights, faq, images, images_v2, delivery_type, course_access_days, published")
    .eq("shop_id", shopId).eq("slug", slug).eq("published", true).maybeSingle();
  if (error) throw error;
  return data;
}, ["public-product-v1", ...namespace], options));

export const getPublicProducts = cache(unstable_cache(async (shopId: string) => {
  const client = createPublicClient();
  const listed = (arranged: boolean) => {
    const query = client.from("products")
      .select("id, slug, name, category, price_cents, compare_price_cents, images, images_v2, delivery_type, created_at")
      .eq("shop_id", shopId).eq("published", true);
    // The seller's arrangement first; products never arranged follow, oldest first.
    return (arranged ? query.order("position", { ascending: true, nullsFirst: false }) : query).order("created_at", { ascending: true });
  };
  const { data, error } = await listed(true);
  if (!error) return data ?? [];
  // Databases without the arrangement column list products by age, as before.
  if (!isMissingColumnError(error, "position")) throw error;
  const fallback = await listed(false);
  if (fallback.error) throw fallback.error;
  return fallback.data ?? [];
}, ["public-products-v2", ...namespace], options));
