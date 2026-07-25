import { describe, expect, it } from "vitest";
import {
  discountPercent,
  formatBytes,
  formatTHB,
} from "@/features/products/format";
import type { ProductEditorValue } from "@/features/products/model";
import {
  validateProductEditor,
  validateProductFile,
  validateProductImages,
} from "@/features/products/validation";

function fileWithSize(name: string, type: string, size: number) {
  const file = new File(["content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

const validValue: ProductEditorValue = {
  name: "E-Book เสริมรายได้",
  price: "199",
  comparePrice: "399",
  category: "E-BOOK",
  descriptionHtml: "<p>อ่านง่าย ใช้ได้จริง</p>",
  productFile: {
    path: "owner/product-files/book.zip",
    fileName: "book.zip",
    size: 1024,
    mimeType: "application/zip",
  },
  images: [],
  highlights: [],
  faq: [],
  published: true,
};

describe("validateProductEditor", () => {
  it("accepts a complete valid product", () => {
    expect(validateProductEditor(validValue)).toEqual({});
  });

  it("rejects a missing product name", () => {
    expect(validateProductEditor({ ...validValue, name: " " }).name).toBe(
      "กรุณากรอกชื่อสินค้า",
    );
  });

  it("rejects a compare price that is not greater than the sale price", () => {
    expect(
      validateProductEditor({
        ...validValue,
        price: "199",
        comparePrice: "99",
      }).comparePrice,
    ).toBe("ราคาเดิมต้องมากกว่าราคาขาย");
  });

  it("requires a successfully uploaded product file", () => {
    expect(
      validateProductEditor({ ...validValue, productFile: null }).productFile,
    ).toBe("กรุณาอัปโหลดไฟล์สินค้า");
  });
});

describe("upload validation", () => {
  it("rejects a product file one byte over 500 MB", () => {
    const tooLarge = fileWithSize(
      "large.zip",
      "application/zip",
      500 * 1024 * 1024 + 1,
    );

    expect(validateProductFile(tooLarge)).toBe(
      "ไฟล์ต้องมีขนาดไม่เกิน 500 MB",
    );
  });

  it("rejects unsupported image formats", () => {
    const gif = fileWithSize("cover.gif", "image/gif", 1024);

    expect(validateProductImages([gif], 0)).toEqual([
      {
        fileName: "cover.gif",
        message: "รองรับเฉพาะ JPG, PNG และ WebP",
      },
    ]);
  });

  it("rejects images beyond the five-slot limit", () => {
    const png = fileWithSize("sixth.png", "image/png", 1024);

    expect(validateProductImages([png], 5)).toEqual([
      {
        fileName: "sixth.png",
        message: "อัปโหลดรูปสินค้าได้สูงสุด 5 รูป",
      },
    ]);
  });
});

describe("product formatting", () => {
  it("formats Thai baht from cents", () => {
    expect(formatTHB(38900)).toBe("฿389");
  });

  it("formats binary file sizes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("rounds the reference discount down to a whole percentage", () => {
    expect(discountPercent(38900, 54900)).toBe(29);
  });
});
