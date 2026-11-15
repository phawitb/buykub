/**
 * Copies the OCR runtime out of node_modules and into public/ocr, so the
 * browser loads it from our own origin instead of a third-party CDN.
 *
 * Only the LSTM cores are copied: the recognizer runs with OEM 1, so the
 * legacy engine would be dead weight. Each `.wasm.js` carries its WebAssembly
 * inline, which is why no separate `.wasm` file is needed.
 *
 * The Thai model (public/ocr/tha.traineddata) is committed instead, because it
 * does not ship inside any package here. Keeping the copy step free of network
 * access means a deploy cannot fail, or silently lose OCR, because GitHub was
 * unreachable during the build. It is stored uncompressed on purpose: a
 * pre-gzipped file invites a host to serve it with Content-Encoding, and the
 * engine would then be handed bytes the browser had already inflated.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "ocr");

const assets = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  [
    "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
    "tesseract-core-relaxedsimd-lstm.wasm.js",
  ],
];

await mkdir(target, { recursive: true });

const model = join(target, "tha.traineddata");
try {
  await stat(model);
} catch {
  throw new Error(
    `Missing ${model}. The Thai OCR model is committed to the repository; restore it from git.`,
  );
}

for (const [from, to] of assets) {
  await copyFile(join(root, "node_modules", from), join(target, to));
}

console.log(`Copied ${assets.length} OCR assets into public/ocr`);
