import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".worktrees/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored agent skills: third-party assets, not this project's source.
    ".agents/**",
    ".claude/skills/**",
    // Course sources and build tools, kept out of git (see content/README.md).
    "content/**",
    // OCR engine copied out of node_modules by scripts/copy-ocr-assets.mjs.
    "public/ocr/**",
    // Exam-prep engine built in the AFAPS-Exam repository (output/web/exam-engine).
    "public/exam-prep/**",
  ]),
]);

export default eslintConfig;
