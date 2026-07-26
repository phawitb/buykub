import { describe, expect, it } from "vitest";
import { parseProductKeys } from "@/features/products/product-keys";

describe("parseProductKeys", () => {
  it("trims lines, removes blanks, and reports duplicates", () => {
    expect(
      parseProductKeys(" ABC-123 \n\nXYZ-789\nABC-123\n xyz-789 "),
    ).toEqual({
      keys: ["ABC-123", "XYZ-789", "xyz-789"],
      blankCount: 1,
      duplicateCount: 1,
    });
  });

  it("preserves case because product keys may be case-sensitive", () => {
    expect(parseProductKeys("abc\nABC").keys).toEqual(["abc", "ABC"]);
  });
});
