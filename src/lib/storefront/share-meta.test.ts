import { describe, expect, it } from "vitest";
import { previewText, shareMetadata } from "./share-meta";

describe("link preview metadata", () => {
  it("names the shop and its image in the tags chat apps read", () => {
    const meta = shareMetadata({ title: "ร้านชีสส์", description: "ชีทสอบ", url: "https://buykub.com/mysheet", image: "https://cdn.test/cover.jpg", siteName: "ร้านชีสส์" });
    expect(meta.openGraph).toMatchObject({ title: "ร้านชีสส์", description: "ชีทสอบ", url: "https://buykub.com/mysheet", siteName: "ร้านชีสส์ · BUYKUB", images: [{ url: "https://cdn.test/cover.jpg" }] });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: ["https://cdn.test/cover.jpg"] });
    expect(meta.alternates).toEqual({ canonical: "https://buykub.com/mysheet" });
  });

  it("leaves the image out rather than falling back to the BUYKUB one", () => {
    const meta = shareMetadata({ title: "ร้าน", description: "", url: "https://buykub.com/a", image: null, siteName: "ร้าน" });
    expect(meta.openGraph).toMatchObject({ images: undefined });
    expect(meta.twitter).toMatchObject({ card: "summary" });
  });

  it("flattens a description to one short line", () => {
    expect(previewText("  บรรทัดแรก\n\nบรรทัดสอง  ")).toBe("บรรทัดแรก บรรทัดสอง");
    expect(previewText("ก".repeat(200))).toHaveLength(155);
    expect(previewText(null)).toBe("");
  });
});
