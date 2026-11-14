import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

const css = readFileSync("src/app/globals.css", "utf8");
function color(token: string) {
  const hex = css.match(new RegExp(`--${token}: #(\\w{6})`))![1];
  return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}
function luminance(rgb: number[]) {
  const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(first: number[], second: number[]) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("brand readability", () => {
  it("keeps secondary text readable on both standard light surfaces", () => {
    // "background" is the grey body ground this theme sits on, so it counts.
    for (const surface of ["paper", "paper-dim", "background"]) {
      expect(contrast(color("muted"), color(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color("ink"), color(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color("accent-text"), color(surface))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(color("paper"), color("ink"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color("paper"), color("accent"))).toBeGreaterThanOrEqual(4.5);
  });

  it("ships the original vector mark in a real multi-size favicon, including 16px", async () => {
    const ico = readFileSync("src/app/favicon.ico");
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    const sizes = [];
    for (let index = 0; index < 3; index++) {
      const entry = 6 + index * 16;
      const size = ico[entry];
      sizes.push(size);
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      const embedded = await sharp(ico.subarray(offset, offset + length)).raw().toBuffer();
      const original = await sharp("src/app/icon.svg").resize(size, size).raw().toBuffer();
      expect(embedded.equals(original)).toBe(true);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });
});
