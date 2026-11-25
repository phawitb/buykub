import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicProducts } from "@/lib/storefront/catalog";
import { getPublicExamSummary } from "@/lib/storefront/exam-summary";
import type { ExamSummary } from "./pack";

export type UpsellItem = { id: string; name: string; href: string; priceCents: number; compareCents: number | null; cover: string | null };
export type ClassroomUpsell = { shopName: string; upgrade: UpsellItem | null; items: UpsellItem[]; upgradeDetails?: string[] };

const count = (n: number) => n.toLocaleString("en-US");

/** What the full version holds, from its published counts: practice per subject and the mock sets. */
export function upgradeDetails(summary: ExamSummary): string[] {
  const n = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  const mocks = n(summary.mocks);
  const perSubject = (Array.isArray(summary.subjects) ? summary.subjects : [])
    .map(s => ({ name: s.short || s.name, practice: n(s.questions) - mocks * n(s.perSet) }))
    .filter(s => s.practice > 0);
  const lines: string[] = [];
  if (n(summary.practice)) lines.push(`ฝึกแยกวิชา ${count(summary.practice)} ข้อ${perSubject.length ? ` (${perSubject.map(s => `${s.name} ${count(s.practice)}`).join(" · ")})` : ""}`);
  if (mocks && n(summary.mockQuestions)) lines.push(`ข้อสอบจำลองเสมือนจริง ${mocks} ชุด ชุดละ ${count(summary.mockQuestions)} ข้อ${n(summary.mockMinutes) ? ` จับเวลา ${summary.mockMinutes} นาที` : ""}`);
  if (n(summary.questions)) lines.push(`รวม ${count(summary.questions)} ข้อ เฉลยทุกข้อ`);
  return lines;
}

/**
 * What a free classroom advertises: the shop's other paid products, the paid
 * drill course with mock sets (the free one's full version) first. Published
 * catalogue data only. Paid classrooms and any failure get no ad.
 */
export async function loadClassroomUpsell(productId: string): Promise<ClassroomUpsell | null> {
  try {
    const client = createPublicClient();
    const { data: product } = await client.from("products").select("shop_id, price_cents").eq("id", productId).maybeSingle();
    if (!product || product.price_cents !== 0) return null;
    const { data: shop } = await client.from("shops").select("slug, name").eq("id", product.shop_id).eq("published", true).maybeSingle();
    if (!shop) return null;
    const products = (await getPublicProducts(product.shop_id)).filter(item => item.id !== productId && item.price_cents > 0);
    const items = products.map(item => {
      const images = Array.isArray(item.images_v2) ? (item.images_v2 as Array<{ publicUrl?: string }>) : [];
      return {
        id: item.id, name: item.name, href: `/${shop.slug}/${item.slug}`,
        priceCents: item.price_cents, compareCents: item.compare_price_cents ?? null,
        cover: images[0]?.publicUrl ?? item.images?.[0] ?? null,
      };
    });
    if (!items.length) return null;
    const summaries = await Promise.all(items.map(item => getPublicExamSummary(item.id).catch(() => null)));
    const index = items.findIndex((_, i) => summaries[i]?.mode === "drill" && summaries[i]!.mocks > 0);
    const upgrade = index >= 0 ? items[index] : null;
    return {
      shopName: shop.name, upgrade, items: upgrade ? [upgrade, ...items.filter(item => item !== upgrade)] : items,
      ...(index >= 0 && upgradeDetails(summaries[index]!).length ? { upgradeDetails: upgradeDetails(summaries[index]!) } : {}),
    };
  } catch {
    return null;
  }
}
