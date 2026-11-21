import { describe, expect, it, vi } from "vitest";
import { canvasToFile } from "@/features/products/pdf/encode";

type Encoder = (type: string, quality?: number) => Blob | null;

/** A canvas stands in for the browser's: only toBlob is ever reached. */
function stubCanvas(encode: Encoder) {
  const toBlob = vi.fn(
    (callback: BlobCallback, type?: string, quality?: number) =>
      callback(encode(type ?? "image/png", quality)),
  );
  return { canvas: { toBlob } as unknown as HTMLCanvasElement, toBlob };
}

function blobOf(bytes: number, type: string) {
  return new Blob([new Uint8Array(bytes)], { type });
}

describe("canvasToFile", () => {
  it("writes a page losslessly, so the cover matches the PDF", async () => {
    // webp at the quality a preview can afford shifts a flat colour by up to
    // 107/255 where it meets another, which the seller sees on their own cover.
    const { canvas } = stubCanvas((type) => blobOf(400_000, type));
    const file = await canvasToFile(canvas, "page-1");

    expect(file.name).toBe("page-1.png");
    expect(file.type).toBe("image/png");
  });

  it("falls back to a high-quality webp when the lossless page is too heavy", async () => {
    const { canvas, toBlob } = stubCanvas((type) =>
      blobOf(type === "image/png" ? 4_000_000 : 300_000, type),
    );
    const file = await canvasToFile(canvas, "page-4");

    expect(file.name).toBe("page-4.webp");
    expect(toBlob.mock.calls.at(-1)?.[2]).toBe(0.92);
  });

  it("keeps the heavy page rather than losing it when nothing lossy is written", async () => {
    // Safari once wrote PNG for every type asked for; the result is checked
    // against the type requested, and a page is better oversized than missing.
    const { canvas } = stubCanvas((type) =>
      type === "image/png" ? blobOf(4_000_000, type) : null,
    );
    const file = await canvasToFile(canvas, "page-5");

    expect(file.type).toBe("image/png");
    expect(file.size).toBe(4_000_000);
  });

  it("reports a page it could not encode at all", async () => {
    const { canvas } = stubCanvas(() => null);
    await expect(canvasToFile(canvas, "page-2")).rejects.toThrow("สร้างรูปตัวอย่างจาก PDF ไม่สำเร็จ");
  });
});
