"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductPlaceholder } from "./ProductPlaceholder";
import {
  neighbourIndex,
  previewCaption,
  remainingPages,
  scrollLeftForSlide,
  slideCounter,
  slideIndexFromScroll,
} from "@/features/storefront/gallery";
import {
  PAGE_EDGE_COLOR,
  PAGE_GROUND_COLOR,
  PAGE_SHADOW_COLOR,
} from "@/features/products/pdf/frame";
import type { ProductDeliveryType, ProductImage } from "@/features/products/model";

/**
 * The buyer's view of what they are about to pay for. The images are pages of
 * a sample, so moving between them has to be as cheap as turning a page: a
 * swipe on a phone, an arrow or a dot anywhere else.
 *
 * The sample is shorter than the file, which is the one thing the track must
 * not leave a buyer guessing about: the counter in the corner counts against
 * the file's own length, and the last swipe lands on a blank sheet saying how
 * many pages are still behind it.
 */
export function ProductGallery({
  images,
  productName,
  deliveryType,
  filePageCount,
}: {
  images: ProductImage[];
  productName: string;
  deliveryType?: ProductDeliveryType;
  /** Pages in the delivered PDF, when the file is one. */
  filePageCount?: number | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const remaining = remainingPages(images.length, filePageCount);
  // The pages on show, plus the sheet that stands for the ones that are not.
  const slideCount = images.length + (remaining > 0 ? 1 : 0);

  // The swipe itself is the browser's: a snapping scroller needs no gesture
  // handling, keeps the momentum the phone's own scrolling has, and leaves the
  // images reachable by keyboard and by screen reader.
  const syncToScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setActiveIndex(slideIndexFromScroll(track.scrollLeft, track.clientWidth, slideCount));
  }, [slideCount]);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    setActiveIndex(index);
    if (!track) return;
    const left = scrollLeftForSlide(index, track.clientWidth);
    if (typeof track.scrollTo === "function") {
      track.scrollTo({ left, behavior: "smooth" });
    } else {
      track.scrollLeft = left;
    }
  }, []);

  // A phone that turns, or a desktop window that resizes, changes how wide a
  // slide is; without this the dots would describe the wrong image.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncToScroll);
    observer.observe(track);
    return () => observer.disconnect();
  }, [syncToScroll]);

  if (!images.length) {
    return (
      <div className="aspect-square overflow-hidden bg-paper-dim">
        <ProductPlaceholder productName={productName} deliveryType={deliveryType} />
      </div>
    );
  }

  const single = slideCount === 1;
  const counter = slideCounter(activeIndex, images.length, filePageCount);
  const caption = previewCaption(images.length, filePageCount);
  const dots = [
    ...images.map((image, index) => ({
      key: image.id,
      label: `ดูรูปที่ ${index + 1}`,
    })),
    ...(remaining > 0
      ? [{ key: "remaining", label: `ดูหน้าที่เหลืออีก ${remaining} หน้า` }]
      : []),
  ];

  return (
    <div>
      <div className="relative bg-paper-dim">
        <div
          ref={trackRef}
          onScroll={syncToScroll}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            goTo(neighbourIndex(activeIndex, event.key === "ArrowRight" ? 1 : -1, slideCount));
          }}
          tabIndex={single ? -1 : 0}
          role="group"
          aria-label={`รูปสินค้า ${productName}`}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <div key={image.id} className="aspect-square w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.publicUrl}
                alt={image.alt || `${productName} ภาพที่ ${index + 1}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          ))}

          {/* The pages the sample stops short of, drawn as one more sheet on
              the same blue mat the preview pages sit on, so it reads as the
              next page in the stack rather than a banner after the gallery. */}
          {remaining > 0 && (
            <div
              className="flex aspect-square w-full shrink-0 snap-center items-center justify-center"
              style={{ backgroundColor: PAGE_GROUND_COLOR }}
            >
              <div
                className="flex h-[78%] w-[55%] flex-col items-center justify-center rounded-[2px] bg-paper px-4 text-center"
                style={{
                  border: `1px solid ${PAGE_EDGE_COLOR}`,
                  boxShadow: `0 10px 24px -12px ${PAGE_SHADOW_COLOR}`,
                }}
              >
                <span className="text-3xl font-bold text-ink tabular-nums sm:text-4xl">
                  +{remaining}
                </span>
                <span className="mt-1 text-sm font-semibold text-ink">หน้า</span>
                <span className="mt-3 block h-px w-10 bg-line-strong" aria-hidden="true" />
                <span className="mt-3 text-xs leading-relaxed text-ink-soft">
                  ที่เหลือในไฟล์ฉบับเต็ม
                  <br />
                  ได้รับหลังชำระเงิน
                </span>
              </div>
            </div>
          )}
        </div>

        {!single && (
          <>
            {/* Counted against the file, not against the sample: "2 / 20" is
                the question the buyer is actually asking of a sample page. */}
            {counter && (
              <p
                aria-live="polite"
                className="pointer-events-none absolute right-4 bottom-4 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-on-ink tabular-nums"
              >
                {counter}
              </p>
            )}

            {/* Pointer devices cannot swipe, so they get the same move as a tap. */}
            {[-1, 1].map((step) => (
              <button
                key={step}
                type="button"
                aria-label={step < 0 ? "รูปก่อนหน้า" : "รูปถัดไป"}
                onClick={() => goTo(neighbourIndex(activeIndex, step, slideCount))}
                disabled={step < 0 ? activeIndex === 0 : activeIndex === slideCount - 1}
                className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink shadow-sm transition hover:bg-paper disabled:pointer-events-none disabled:opacity-0 sm:flex ${
                  step < 0 ? "left-3" : "right-3"
                }`}
              >
                <span aria-hidden="true">{step < 0 ? "‹" : "›"}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {(!single || caption) && (
        <div className="bg-paper px-5 py-4">
          {!single && (
            <div className="flex items-center justify-center gap-2">
              {dots.map((dot, index) => (
                <button
                  key={dot.key}
                  type="button"
                  aria-label={dot.label}
                  aria-current={activeIndex === index}
                  onClick={() => goTo(index)}
                  // A dot is a small target, so the button stays finger-sized
                  // and only the mark inside it is small.
                  className="flex h-8 w-6 items-center justify-center"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-2 rounded-full transition-all ${
                      activeIndex === index ? "w-5 bg-accent" : "w-2 bg-line-strong"
                    } ${
                      // The closing sheet is not a page of the sample, so its
                      // dot is outlined rather than filled.
                      dot.key === "remaining" && activeIndex !== index
                        ? "border border-line-strong bg-transparent"
                        : ""
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Sits with the dots rather than down in the description, because
              the number it speaks for is the one on the image above it. */}
          {caption && (
            <p
              className={`text-center text-xs font-medium text-ink-soft tabular-nums ${
                single ? "" : "mt-2"
              }`}
            >
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
