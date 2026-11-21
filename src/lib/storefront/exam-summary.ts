import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { isMissingColumnError } from "@/lib/supabase/missing-column";
import { readExamSummary } from "@/features/courses/exam-prep/pack";
import { PUBLIC_CATALOG_TAG } from "./tags";

const namespace = [process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public"];

/** Public counts of a published exam-prep course (subjects, days, questions). Never pack content. */
export const getPublicExamSummary = cache(unstable_cache(async (productId: string) => {
  const { data, error } = await createPublicClient().from("products")
    .select("course_format, exam_summary")
    .eq("id", productId).eq("published", true).maybeSingle();
  if (error) {
    // Older databases without the exam-prep columns simply have no exam courses.
    if (isMissingColumnError(error, "course_format") || isMissingColumnError(error, "exam_summary")) return null;
    throw error;
  }
  return data?.course_format === "exam_prep" ? readExamSummary(data.exam_summary) : null;
}, ["public-exam-summary-v1", ...namespace], { revalidate: 60, tags: [PUBLIC_CATALOG_TAG] }));
