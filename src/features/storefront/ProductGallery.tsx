"use client";

import { useState } from "react";
import type { ProductImage } from "@/features/products/model";

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div>
      <div className="aspect-square overflow-hidden bg-paper-dim">
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.publicUrl}
            alt={active.alt || productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={`ยังไม่มีรูปสำหรับ ${productName}`}
            className="flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(145deg,var(--color-paper-dim),var(--color-accent-soft))] text-muted"
          >
            <span className="text-6xl">◇</span>
            <span className="mt-3 text-sm">ยังไม่มีรูปสินค้า</span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto bg-paper px-5 py-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`ดูรูปที่ ${index + 1}`}
              aria-pressed={activeIndex === index}
              onClick={() => setActiveIndex(index)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                activeIndex === index ? "border-accent" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.publicUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
