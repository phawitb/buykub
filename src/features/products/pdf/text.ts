"use client";

/**
 * Turns the positioned fragments pdf.js reports into reading order.
 *
 * A PDF carries no words, only glyphs at coordinates. Chromium's exporter
 * splits a Thai run wherever it repositions for a combining mark, so a single
 * word such as หนังสือ arrives as five fragments sitting flush against each
 * other. Guessing a space at every fragment boundary — the obvious reading of
 * the data — inserted one bogus space every six characters in a measured
 * 44-page export, leaving ส รุ ปเ นื อหา where สรุปเนื้อหา was written.
 *
 * The geometry says where the spaces really are: a fragment that starts where
 * the previous one ended continues the same word.
 */

/** Below this share of an em, two fragments are touching, not separated. */
const SPACE_GAP_RATIO = 0.2;

/** Above this share of an em, the baseline moved far enough to be a new line. */
const LINE_BREAK_RATIO = 0.6;

/** Used when a fragment reports no height, so the ratios stay meaningful. */
const FALLBACK_EM = 10;

/**
 * Control characters stand in for glyphs the producer could not name: a subset
 * font without a ToUnicode entry for a Thai tone mark yields U+0000 where the
 * mark was drawn. The mark is gone from the file either way, and keeping the
 * placeholder would hand the model — and any database column — a NUL byte.
 */
const UNMAPPED_GLYPH = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

type TextFragment = {
  str: string;
  width: number;
  height: number;
  x: number;
  y: number;
  hasEOL: boolean;
};

/** Puts Thai sara am back together, however the producer spelled it. */
export function recomposeThai(text: string): string {
  return (
    text
      .normalize("NFC")
      // NIKHAHIT + SARA AA is how both Chromium's exporter and the recognizer
      // spell SARA AM, and it reads as a different word.
      .replace(/ํา/g, "ำ")
      // A tone mark written between the two halves belongs on the outside.
      .replace(/ํ([่-์])า/g, "$1ำ")
  );
}

function readFragment(raw: unknown): TextFragment | null {
  if (!raw || typeof raw !== "object" || !("str" in raw)) return null;
  const item = raw as {
    str?: unknown;
    width?: unknown;
    height?: unknown;
    transform?: unknown;
    hasEOL?: unknown;
  };
  if (typeof item.str !== "string") return null;
  const transform = Array.isArray(item.transform) ? item.transform : [];
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    str: item.str,
    width: number(item.width),
    height: number(item.height),
    x: number(transform[4]),
    y: number(transform[5]),
    hasEOL: item.hasEOL === true,
  };
}

function em(previous: TextFragment, next: TextFragment): number {
  return Math.min(previous.height || FALLBACK_EM, next.height || FALLBACK_EM);
}

/** True when the fragment starts where the previous one ended. */
function continuesLine(previous: TextFragment, next: TextFragment): boolean {
  return Math.abs(next.x - (previous.x + previous.width)) <= em(previous, next) * SPACE_GAP_RATIO;
}

/** True when the baseline moved enough that the fragments are on two lines. */
export function startsNewLine(previous: TextFragment, next: TextFragment): boolean {
  const height = Math.max(previous.height, next.height) || FALLBACK_EM;
  if (Math.abs(next.y - previous.y) <= height * LINE_BREAK_RATIO) return false;
  // An arched or rotated heading walks down the page while still running along
  // one line, so a moved baseline on its own does not mean the line ended.
  return !continuesLine(previous, next);
}

/** True when visible space separates the fragments, rather than nothing at all. */
export function separatedByGap(previous: TextFragment, next: TextFragment): boolean {
  return next.x - (previous.x + previous.width) > em(previous, next) * SPACE_GAP_RATIO;
}

function tidy(text: string): string {
  return text
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reads one page's positioned fragments into text, in reading order. */
export function joinTextItems(items: readonly unknown[]): string {
  let text = "";
  let previous: TextFragment | null = null;
  let pendingBreak = false;

  for (const raw of items) {
    const fragment = readFragment(raw);
    if (!fragment) continue;
    const str = fragment.str.replace(UNMAPPED_GLYPH, "");
    if (!str) {
      // The exporter marks a line end with an empty fragment of its own.
      if (fragment.hasEOL) pendingBreak = true;
      continue;
    }

    if (previous) {
      if (pendingBreak || previous.hasEOL || startsNewLine(previous, fragment)) text += "\n";
      else if (separatedByGap(previous, fragment)) text += " ";
    }
    pendingBreak = false;
    text += str;
    previous = fragment;
  }

  return recomposeThai(tidy(text));
}
