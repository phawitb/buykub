/**
 * Which slide a swipe has landed on. The track is one slide wide, so the
 * scroll offset divided by that width is the index — rounded, because a swipe
 * stops wherever the finger left it and the snap settles afterwards.
 */
export function slideIndexFromScroll(
  scrollLeft: number,
  slideWidth: number,
  count: number,
): number {
  if (slideWidth <= 0 || count <= 0) return 0;
  const index = Math.round(scrollLeft / slideWidth);
  return Math.min(count - 1, Math.max(0, index));
}

/** Where the track has to scroll to put a given slide in view. */
export function scrollLeftForSlide(index: number, slideWidth: number): number {
  return Math.max(0, index) * Math.max(0, slideWidth);
}

/**
 * How many pages of the file the sample does not show. The gallery turns this
 * into one more slide at the end of the track — a blank sheet reading "+15
 * หน้า" — so the sample ends by saying what is still behind it instead of
 * simply running out.
 */
export function remainingPages(
  previewCount: number,
  filePageCount: number | null | undefined,
): number {
  if (!filePageCount || filePageCount <= 0 || previewCount <= 0) return 0;
  return Math.max(0, filePageCount - previewCount);
}

/**
 * The counter in the corner of the image. It used to count the sample ("5 /
 * 5"), which a buyer reads as the length of the whole product, so it counts
 * against the file's own length instead. On the closing slide there is no page
 * to number, so it states the total outright.
 */
export function slideCounter(
  activeIndex: number,
  previewCount: number,
  filePageCount: number | null | undefined,
): string | null {
  if (previewCount <= 0) return null;
  const total =
    filePageCount && filePageCount > previewCount ? filePageCount : previewCount;
  if (activeIndex >= previewCount) return `ทั้งหมด ${total} หน้า`;
  if (total <= 1) return null;
  return `${activeIndex + 1} / ${total}`;
}

/**
 * The line under the dots, for the one case the slides cannot carry: a sample
 * that is the whole file. There is no "+x หน้า" slide to end on then, and the
 * counter's "5 / 5" still needs saying out loud to be read as the file's
 * length rather than the sample's.
 */
export function previewCaption(
  previewCount: number,
  filePageCount: number | null | undefined,
): string | null {
  if (!filePageCount || filePageCount <= 0 || previewCount <= 0) return null;
  if (previewCount < filePageCount) return null;
  return `ไฟล์นี้มีทั้งหมด ${filePageCount} หน้า`;
}

/** The slide a left/right key or an arrow button moves to, without wrapping. */
export function neighbourIndex(current: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, current + step));
}
