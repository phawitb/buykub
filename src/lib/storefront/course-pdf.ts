import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_CATALOG_TAG } from "./tags";

const namespace = [process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public"];

/** Whether a published course comes with a PDF. Only the yes or no leaves the server, never the file's path. */
export const getCourseHasPdf = cache(unstable_cache(async (productId: string) => {
  const { data, error } = await createAdminClient().from("products")
    .select("file_path")
    .eq("id", productId).eq("delivery_type", "course").eq("published", true).maybeSingle();
  if (error) throw error;
  return Boolean(data?.file_path);
}, ["public-course-has-pdf-v1", ...namespace], { revalidate: 60, tags: [PUBLIC_CATALOG_TAG] }));
