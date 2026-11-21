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
  deliveryType: "file",
  keyInput: "",
  keyInventory: { available: 0, assigned: 0, disabled: 0 },
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
  it("requires whole positive days for courses and accepts lifetime without a file", () => {
    expect(validateProductEditor({...validValue,deliveryType:"course",productFile:null,courseAccessDays:""})).toEqual({});
    expect(validateProductEditor({...validValue,deliveryType:"course",productFile:null,courseAccessDays:"1.5"}).courseAccessDays).toBeTruthy();
  });

  it("accepts a complete valid product", () => {
    expect(validateProductEditor(validValue)).toEqual({});
  });

  it("keeps paid prices at Stripe's ฿10 minimum and still allows free products", () => {
    expect(validateProductEditor({ ...validValue, price: "1", comparePrice: "" }).price).toBe("ราคาขั้นต่ำ ฿10 (หรือ 0 สำหรับสินค้าฟรี)");
    expect(validateProductEditor({ ...validValue, price: "10", comparePrice: "" })).toEqual({});
    expect(validateProductEditor({ ...validValue, price: "0", comparePrice: "" })).toEqual({});
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

  it("accepts a published key product with imported stock and no file", () => {
    expect(
      validateProductEditor({
        ...validValue,
        deliveryType: "key",
        productFile: null,
        keyInput: "KEY-001",
      }),
    ).toEqual({});
  });

  it("requires stock before publishing a key product", () => {
    expect(
      validateProductEditor({
        ...validValue,
        deliveryType: "key",
        productFile: null,
        keyInput: "",
      }).productKeys,
    ).toBe("กรุณาเพิ่ม Key อย่างน้อย 1 รายการก่อนเผยแพร่");
  });

  it("allows an out-of-stock key product to be saved as a draft", () => {
    expect(
      validateProductEditor({
        ...validValue,
        deliveryType: "key",
        productFile: null,
        keyInput: "",
        published: false,
      }),
    ).toEqual({});
  });
});

describe("upload validation", () => {
  it("rejects a product file one byte over 50 MB", () => {
    const tooLarge = fileWithSize(
      "large.zip",
      "application/zip",
      50 * 1024 * 1024 + 1,
    );

    expect(validateProductFile(tooLarge)).toBe(
      "ไฟล์ต้องมีขนาดไม่เกิน 50 MB",
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
