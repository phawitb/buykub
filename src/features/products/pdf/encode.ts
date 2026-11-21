"use client";

/**
 * A preview page has to match the PDF it came from. The seller compares the
 * cover on the storefront against the cover in their reader, and a lossy
 * encoder loses that comparison: webp at quality 0.82 shifts a flat brand
 * colour by up to 107/255 at its edges, because chroma subsampling averages
 * colour across pixels that a page of type and solid fills has no spare
 * resolution for. PNG is exact. It costs roughly three times the bytes, so a
 * page that comes out unusually large falls back to a high-quality lossy pass
 * rather than pushing a 5 MB upload over its limit.
 */
const MAX_LOSSLESS_BYTES = 1_500_000;

/** High enough that the shift is invisible; only reached by dense pages. */
const FALLBACK_QUALITY = 0.92;

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch {
      resolve(null);
    }
  });
}

export function shouldFallBackFromPng(bytes: number): boolean {
  return bytes > MAX_LOSSLESS_BYTES;
}

/**
 * Encodes a rendered page, preferring an exact copy of what was drawn.
 * `canvas.toBlob` falls back to PNG for a type the browser cannot write, so
 * each result is checked against the type that was asked for.
 */
export async function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<File> {
  const png = await encode(canvas, "image/png");
  if (png && !shouldFallBackFromPng(png.size)) {
    return new File([png], `${fileName}.png`, { type: "image/png" });
  }

  for (const [type, extension] of [
    ["image/webp", "webp"],
    ["image/jpeg", "jpg"],
  ] as const) {
    const blob = await encode(canvas, type, FALLBACK_QUALITY);
    if (blob && blob.type === type) {
      return new File([blob], `${fileName}.${extension}`, { type });
    }
  }

  // Nothing lossy was available, so the large PNG beats no image at all.
  if (png) return new File([png], `${fileName}.png`, { type: "image/png" });
  throw new Error("สร้างรูปตัวอย่างจาก PDF ไม่สำเร็จ");
}
