import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vitest workspace boundaries", () => {
  it("does not collect tests from nested git worktrees", () => {
    const source = readFileSync("vitest.config.ts", "utf8");

    expect(source).toContain("configDefaults.exclude");
    expect(source).toContain('"**/.worktrees/**"');
  });

  it("does not lint generated files inside nested git worktrees", () => {
    const source = readFileSync("eslint.config.mjs", "utf8");

    expect(source).toContain('".worktrees/**"');
  });
});
