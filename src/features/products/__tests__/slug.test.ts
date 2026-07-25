import { describe, expect, it } from "vitest";
import {
  slugifyProductName,
  uniqueProductSlug,
} from "@/features/products/slug";

describe("slugifyProductName", () => {
  it("keeps stable latin words and removes unsupported Thai characters", () => {
    expect(slugifyProductName("E-Book เสริมรายได้ 2026")).toBe("e-book-2026");
  });

  it("falls back to product for a name without URL-safe characters", () => {
    expect(slugifyProductName("หนังสือดิจิทัล")).toBe("product");
  });
});

describe("uniqueProductSlug", () => {
  it("returns the base when it is available", () => {
    expect(uniqueProductSlug("e-book", ["audio-book"])).toBe("e-book");
  });

  it("uses the first available numeric suffix", () => {
    expect(uniqueProductSlug("e-book", ["e-book", "e-book-2"])).toBe(
      "e-book-3",
    );
  });
});
