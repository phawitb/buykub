import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_COVERS, getDefaultCover, getShopCover } from "./covers";

describe("stored shop covers", () => {
  it("has ten local licensed images with source and author credits", () => {
    expect(DEFAULT_COVERS).toHaveLength(10);
    for (const cover of DEFAULT_COVERS) {
      expect(existsSync(join(process.cwd(), "public", cover.path))).toBe(true);
      expect(readFileSync(join(process.cwd(), "public", cover.path)).length).toBeGreaterThan(1000);
      expect(cover.source).toMatch(/^https:\/\/unsplash.com\/photos\//);
      expect(cover.author.length).toBeGreaterThan(1);
    }
  });
  it("keeps the fallback stable across server/client renders and spreads shops across covers", () => {
    expect(getDefaultCover("same-shop")).toEqual(getDefaultCover("same-shop"));
    const choices = new Set(Array.from({ length: 100 }, (_, i) => getDefaultCover(`shop-${i}`).path));
    expect(choices.size).toBe(10);
    expect(DEFAULT_COVERS).toContainEqual(getDefaultCover("ร้านภาษาไทย"));
  });
  it("always keeps a seller uploaded cover instead of a default", () => {
    expect(getShopCover({ slug: "test", cover_url: "https://example.com/my-cover.webp" })).toBe("https://example.com/my-cover.webp");
    expect(getShopCover({ slug: "test", cover_url: null })).toBe(getDefaultCover("test").path);
  });
});
