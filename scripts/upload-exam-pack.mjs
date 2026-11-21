/**
 * Uploads a built exam-prep pack to an existing exam-prep course, as the
 * service role. This is the same thing the seller's "อัปโหลดแพ็ก" button does,
 * for setting courses up from a terminal:
 *
 *   node --env-file=.env.local scripts/upload-exam-pack.mjs <product-id> <dist-dir>
 *
 * <dist-dir> is a build_pack.py output folder holding pack.json and
 * summary.json (AFAPS output/web/exam-engine/dist/<course>). The pack goes to
 * the derived private path {owner}/exam-prep/{product}/pack.json; only the
 * summary is written to the product row. It does not publish the course.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const [productId, dir] = process.argv.slice(2);
if (!productId || !dir) {
  console.error("usage: node --env-file=.env.local scripts/upload-exam-pack.mjs <product-id> <dist-dir>");
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const packText = await readFile(join(dir, "pack.json"), "utf8");
const pack = JSON.parse(packText);
const summary = JSON.parse(await readFile(join(dir, "summary.json"), "utf8"));
if (pack.format !== "exam-prep" || pack.version !== 1) throw new Error("pack.json is not a version 1 exam-prep pack");
if (summary.format !== "exam-prep" || summary.id !== pack.id) throw new Error("summary.json does not belong to this pack");

const supabase = createClient(url, key, {
  db: { schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "buykub" },
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: product, error } = await supabase.from("products")
  .select("id, name, delivery_type, course_format, exam_summary, shops(owner_id)")
  .eq("id", productId).maybeSingle();
if (error) throw error;
if (!product) throw new Error(`No product ${productId}`);
if (product.delivery_type !== "course" || product.course_format !== "exam_prep") throw new Error(`${product.name} is not an exam-prep course`);
// Learner progress is keyed by question ids, so a course keeps one pack lineage.
if (product.exam_summary?.id && product.exam_summary.id !== pack.id) throw new Error(`${product.name} holds pack "${product.exam_summary.id}", not "${pack.id}"`);
const ownerId = product.shops?.owner_id;
if (!ownerId) throw new Error("Product has no shop owner");

const path = `${ownerId}/exam-prep/${productId}/pack.json`;
const upload = await supabase.storage.from("product-files")
  .upload(path, new Blob([packText], { type: "application/json" }), { upsert: true, contentType: "application/json" });
if (upload.error) throw upload.error;
const update = await supabase.from("products")
  .update({ exam_summary: summary, updated_at: new Date().toISOString() }).eq("id", productId);
if (update.error) throw update.error;

console.log(`${product.name}: ${summary.questions} questions, ${summary.days} days, ${(packText.length / 1024 / 1024).toFixed(1)} MB → product-files/${path}`);
