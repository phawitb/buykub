import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

/** Collapses a description into one line for chat and social link previews, which show about this much. */
export function previewText(text: string | null | undefined, max = 155) {
  const line = (text ?? "").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/**
 * The tags LINE, Facebook and other apps read for a link preview, so a shared
 * shop or product link shows that shop or product rather than the BUYKUB home.
 */
export function shareMetadata({ title, description, url, image, siteName }: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  siteName: string;
}): Metadata {
  const images = image ? [{ url: image }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "th_TH", title, description, url, siteName: `${siteName} · ${BRAND_NAME}`, images },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}
