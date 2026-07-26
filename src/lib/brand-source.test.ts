import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function legacyBrandMatches() {
  try {
    return execFileSync(
      "rg",
      [
        "-n",
        "FRAMELINK|Framelink|framelink\\.app|hello@framelink\\.app",
        "src",
        "--glob",
        "!**/*.test.*",
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    const result = error as { status?: number; stdout?: string };
    if (result.status === 1) return result.stdout ?? "";
    throw error;
  }
}

describe("customer-facing brand source", () => {
  it("does not contain the legacy customer brand or domain", () => {
    expect(legacyBrandMatches()).toBe("");
  });
});
