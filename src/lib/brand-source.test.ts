import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LEGACY_BRAND = /FRAMELINK|Framelink|framelink\.app|hello@framelink\.app/;

/**
 * Scans with Node rather than spawning `rg`: ripgrep is not installed on every
 * machine that runs this suite, and a missing binary used to fail this test for
 * a reason that had nothing to do with the brand.
 */
function legacyBrandMatches(dir = "src"): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...legacyBrandMatches(path));
      continue;
    }
    if (/\.test\.[^.]+$/.test(entry.name)) continue;
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (LEGACY_BRAND.test(line)) hits.push(`${path}:${index + 1}:${line.trim()}`);
      });
  }
  return hits;
}

describe("customer-facing brand source", () => {
  it("does not contain the legacy customer brand or domain", () => {
    expect(legacyBrandMatches()).toEqual([]);
  });
});
