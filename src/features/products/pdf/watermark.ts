export type WatermarkTile = { x: number; y: number };

export type ProtectedPreviewOptions = {
  blurStrength: number;
  watermarkOpacity: number;
  watermarkText: string;
};

/**
 * Horizontal. A tilted mark reads as a stamp over someone else's page; the
 * seller wants the page itself to stay readable and upright, so the marks run
 * with the lines of text instead of across them.
 */
export const WATERMARK_ANGLE = 0;

/**
 * Tiles that cover a rotated rectangle. The grid is laid out around the origin
 * over the page diagonal, so a rotated pass still reaches every corner.
 */
export function watermarkTiles(
  width: number,
  height: number,
  stepX: number,
  stepY: number,
): WatermarkTile[] {
  if (width <= 0 || height <= 0 || stepX <= 0 || stepY <= 0) return [];
  const reach = Math.ceil(Math.hypot(width, height) / 2);
  const columns = Math.ceil(reach / stepX);
  const rows = Math.ceil(reach / stepY);
  const tiles: WatermarkTile[] = [];
  for (let row = -rows; row <= rows; row += 1) {
    // Offset every other row so the marks read as a pattern, not a grid.
    const shift = row % 2 === 0 ? 0 : stepX / 2;
    for (let column = -columns; column <= columns; column += 1) {
      tiles.push({ x: column * stepX + shift, y: row * stepY });
    }
  }
  return tiles;
}

export function watermarkFontSize(width: number): number {
  return Math.max(16, Math.round(width / 20));
}

/**
 * Blurs a rendered page and stamps it with repeated marks, so a sample page
 * shows the layout and quality without being usable as the product.
 */
export function drawProtectedPreview(
  source: HTMLCanvasElement,
  options: ProtectedPreviewOptions,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;

  const blur = Math.max(0, options.blurStrength);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (blur > 0) context.filter = `blur(${blur}px)`;
  // Overdraw by the blur radius so the softened edge falls outside the frame
  // instead of leaving a pale border around the page.
  const bleed = Math.ceil(blur * 2);
  context.drawImage(
    source,
    -bleed,
    -bleed,
    canvas.width + bleed * 2,
    canvas.height + bleed * 2,
  );
  context.filter = "none";

  const text = options.watermarkText.trim();
  if (!text) return canvas;

  const fontSize = watermarkFontSize(canvas.width);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(WATERMARK_ANGLE);
  context.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.globalAlpha = Math.min(1, Math.max(0.05, options.watermarkOpacity / 100));
  const stepX = Math.max(fontSize * 4, context.measureText(text).width + fontSize * 2);
  const stepY = fontSize * 4;
  for (const tile of watermarkTiles(canvas.width, canvas.height, stepX, stepY)) {
    context.lineWidth = Math.max(1, fontSize / 12);
    context.strokeStyle = "rgba(255, 255, 255, 0.65)";
    context.strokeText(text, tile.x, tile.y);
    context.fillStyle = "#0a0a0a";
    context.fillText(text, tile.x, tile.y);
  }
  context.restore();
  return canvas;
}
