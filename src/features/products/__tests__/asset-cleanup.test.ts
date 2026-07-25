import { describe, expect, it } from "vitest";
import type { ProductEditorValue } from "@/features/products/model";
import {
  findNewProductAssets,
  findRemovedProductAssets,
} from "@/features/products/asset-cleanup";

const initial: ProductEditorValue = {
  name: "Product",
  price: "100",
  comparePrice: "",
  category: "E-BOOK",
  descriptionHtml: "",
  productFile: {
    path: "user/old-product.zip",
    fileName: "old-product.zip",
    size: 100,
    mimeType: "application/zip",
  },
  images: [
    {
      id: "cover",
      path: "user/cover.webp",
      publicUrl: "https://example.com/cover.webp",
      alt: "Cover",
    },
    {
      id: "inside",
      path: "user/inside.webp",
      publicUrl: "https://example.com/inside.webp",
      alt: "Inside",
    },
  ],
  highlights: [],
  faq: [],
  published: true,
};

describe("findRemovedProductAssets", () => {
  it("returns only persisted files and images no longer referenced by the editor", () => {
    const current: ProductEditorValue = {
      ...initial,
      productFile: {
        path: "user/new-product.zip",
        fileName: "new-product.zip",
        size: 200,
        mimeType: "application/zip",
      },
      images: [
        initial.images[1],
        {
          id: "new",
          path: "user/new.webp",
          publicUrl: "https://example.com/new.webp",
          alt: "New",
        },
      ],
    };

    expect(findRemovedProductAssets(initial, current)).toEqual([
      { destination: "product-file", path: "user/old-product.zip" },
      { destination: "product-image", path: "user/cover.webp" },
    ]);
  });
});

describe("findNewProductAssets", () => {
  it("returns only newly uploaded draft assets", () => {
    expect(
      findNewProductAssets(initial, {
        ...initial,
        productFile: {
          path: "user/new.zip",
          fileName: "new.zip",
          size: 20,
          mimeType: "application/zip",
        },
        images: [
          initial.images[0],
          {
            id: "new",
            path: "user/new.webp",
            publicUrl: "https://example.com/new.webp",
            alt: "",
          },
        ],
      }),
    ).toEqual([
      { destination: "product-file", path: "user/new.zip" },
      { destination: "product-image", path: "user/new.webp" },
    ]);
  });
});
