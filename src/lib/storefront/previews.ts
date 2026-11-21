import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { isMissingColumnError } from "@/lib/supabase/missing-column";
import { normalizePreviewImages } from "@/features/products/previews";
import { PUBLIC_CATALOG_TAG } from "./tags";

const namespace = [process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public"];

/** A published product's sample images, already blurred or marked as the seller chose. */
export const getPublicPreviewImages = cache(unstable_cache(async (productId: string) => {
  const { data, error } = await createPublicClient().from("products")
    .select("preview_images")
    .eq("id", productId).eq("published", true).maybeSingle();
  if (error) {
    // A database without the column has no previews yet.
    if (isMissingColumnError(error, "preview_images")) return [];
    throw error;
  }
  return normalizePreviewImages(data?.preview_images).map(({ id, publicUrl, width, height }) => ({ id, publicUrl, width, height }));
}, ["public-preview-images-v1", ...namespace], { revalidate: 60, tags: [PUBLIC_CATALOG_TAG] }));
