import type { ProductPreviewImage } from "@/features/products/model";

export const MAX_PREVIEW_IMAGES = 12;

/** Keeps only well-formed entries, so a hand-edited row cannot break the page. */
export function normalizePreviewImages(raw: unknown): ProductPreviewImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): ProductPreviewImage[] => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || typeof entry.path !== "string" || typeof entry.publicUrl !== "string") return [];
    if (!/^https:\/\//.test(entry.publicUrl)) return [];
    return [{
      id: entry.id,
      path: entry.path,
      publicUrl: entry.publicUrl,
      width: Number(entry.width) > 0 ? Number(entry.width) : 0,
      height: Number(entry.height) > 0 ? Number(entry.height) : 0,
      blur: entry.blur === true,
      watermark: entry.watermark === true,
    }];
  }).slice(0, MAX_PREVIEW_IMAGES);
}
