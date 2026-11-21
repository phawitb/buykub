import { describe, expect, it } from "vitest";
import { MAX_PREVIEW_IMAGES, normalizePreviewImages } from "@/features/products/previews";

describe("normalizePreviewImages", () => {
  it("keeps well-formed samples and drops anything else", () => {
    expect(normalizePreviewImages([
      { id: "a", path: "u/a.png", publicUrl: "https://cdn.example/a.png", width: 800, height: 600, blur: true, watermark: false },
      { id: "b", path: "u/b.png", publicUrl: "javascript:alert(1)" },
      { id: "c" },
      "nope",
    ])).toEqual([
      { id: "a", path: "u/a.png", publicUrl: "https://cdn.example/a.png", width: 800, height: 600, blur: true, watermark: false },
    ]);
    expect(normalizePreviewImages(null)).toEqual([]);
  });

  it("never lists more than the limit", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: `${index}`, path: `u/${index}.png`, publicUrl: `https://cdn.example/${index}.png` }));
    expect(normalizePreviewImages(many)).toHaveLength(MAX_PREVIEW_IMAGES);
  });
});
