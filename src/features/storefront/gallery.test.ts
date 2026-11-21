import { describe, expect, it } from "vitest";
import {
  neighbourIndex,
  previewCaption,
  remainingPages,
  scrollLeftForSlide,
  slideCounter,
  slideIndexFromScroll,
} from "@/features/storefront/gallery";

describe("slideIndexFromScroll", () => {
  it("reads the slide a settled swipe is on", () => {
    expect(slideIndexFromScroll(0, 390, 5)).toBe(0);
    expect(slideIndexFromScroll(390, 390, 5)).toBe(1);
    expect(slideIndexFromScroll(1560, 390, 5)).toBe(4);
  });

  it("rounds a swipe still between two slides to the nearer one", () => {
    expect(slideIndexFromScroll(170, 390, 5)).toBe(0);
    expect(slideIndexFromScroll(230, 390, 5)).toBe(1);
  });

  it("stays inside the gallery when the scroll overshoots", () => {
    expect(slideIndexFromScroll(-40, 390, 5)).toBe(0);
    expect(slideIndexFromScroll(9999, 390, 5)).toBe(4);
  });

  it("falls back to the first slide before the track has been measured", () => {
    expect(slideIndexFromScroll(300, 0, 5)).toBe(0);
    expect(slideIndexFromScroll(300, 390, 0)).toBe(0);
  });
});

describe("scrollLeftForSlide", () => {
  it("lines a slide up with the left edge of the track", () => {
    expect(scrollLeftForSlide(0, 390)).toBe(0);
    expect(scrollLeftForSlide(3, 390)).toBe(1170);
  });
});

describe("neighbourIndex", () => {
  it("steps one image at a time", () => {
    expect(neighbourIndex(0, 1, 5)).toBe(1);
    expect(neighbourIndex(3, -1, 5)).toBe(2);
  });

  it("stops at the ends instead of wrapping round", () => {
    expect(neighbourIndex(0, -1, 5)).toBe(0);
    expect(neighbourIndex(4, 1, 5)).toBe(4);
  });
});

describe("remainingPages", () => {
  it("counts the pages the sample stops short of", () => {
    expect(remainingPages(5, 20)).toBe(15);
    expect(remainingPages(1, 12)).toBe(11);
  });

  it("has nothing left over when the sample is the whole file", () => {
    expect(remainingPages(5, 5)).toBe(0);
    // More images than pages means pictures were added by hand.
    expect(remainingPages(7, 5)).toBe(0);
  });

  it("stays at zero for a product whose file never reported its length", () => {
    expect(remainingPages(5, null)).toBe(0);
    expect(remainingPages(5, undefined)).toBe(0);
    expect(remainingPages(5, 0)).toBe(0);
    expect(remainingPages(0, 20)).toBe(0);
  });
});

describe("slideCounter", () => {
  it("counts the sample page against the length of the file", () => {
    expect(slideCounter(0, 5, 20)).toBe("1 / 20");
    expect(slideCounter(4, 5, 20)).toBe("5 / 20");
  });

  it("states the total on the closing sheet, which is no page of its own", () => {
    expect(slideCounter(5, 5, 20)).toBe("ทั้งหมด 20 หน้า");
  });

  it("falls back to counting the images when the file said nothing", () => {
    expect(slideCounter(1, 3, null)).toBe("2 / 3");
    expect(slideCounter(0, 1, null)).toBeNull();
    expect(slideCounter(0, 0, 20)).toBeNull();
  });
});

describe("previewCaption", () => {
  it("says so plainly when the sample is the whole file", () => {
    expect(previewCaption(5, 5)).toBe("ไฟล์นี้มีทั้งหมด 5 หน้า");
    expect(previewCaption(7, 5)).toBe("ไฟล์นี้มีทั้งหมด 5 หน้า");
  });

  it("leaves a shorter sample to the counter and the closing sheet", () => {
    expect(previewCaption(5, 20)).toBeNull();
  });

  it("stays silent about a file that never reported its length", () => {
    expect(previewCaption(5, null)).toBeNull();
    expect(previewCaption(5, undefined)).toBeNull();
    expect(previewCaption(5, 0)).toBeNull();
    expect(previewCaption(0, 42)).toBeNull();
  });
});
