import { describe, expect, it } from "vitest";
import {
  normalizeLinkUrl,
  normalizeYoutubeUrl,
} from "@/features/products/components/rich-text-urls";

describe("normalizeLinkUrl", () => {
  it.each([
    ["example.com", "https://example.com/"],
    ["https://example.com/path", "https://example.com/path"],
    ["http://example.com", "http://example.com/"],
    ["  framelink.app/store  ", "https://framelink.app/store"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeLinkUrl(input)).toBe(expected);
  });

  it.each(["", "not a url", "javascript:alert(1)", "ftp://example.com"])(
    "rejects unsupported link %s",
    (input) => {
      expect(normalizeLinkUrl(input)).toBeNull();
    },
  );
});

describe("normalizeYoutubeUrl", () => {
  it.each([
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ],
    [
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ],
    [
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ],
    [
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeYoutubeUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "https://example.com/video",
    "https://youtube.com/watch?v=short",
    "javascript:alert(1)",
  ])("rejects unsupported video URL %s", (input) => {
    expect(normalizeYoutubeUrl(input)).toBeNull();
  });
});
