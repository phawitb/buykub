import { validAccessDays } from "@/features/courses/validation";
import type {
  ProductEditorValue,
  ProductFieldErrors,
  ProductImageValidationError,
} from "@/features/products/model";
import { parseProductKeys } from "@/features/products/product-keys";

export const MAX_PRODUCT_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 5;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Stripe will not charge less than ฿10 in THB, so a cheaper paid product could never be bought. */
export const MIN_PAID_PRICE_BAHT = 10;

export function validateProductEditor(
  value: ProductEditorValue,
): ProductFieldErrors {
  const errors: ProductFieldErrors = {};
  const price = Number(value.price);
  const comparePrice = value.comparePrice ? Number(value.comparePrice) : null;

  if (!value.name.trim()) errors.name = "กรุณากรอกชื่อสินค้า";
  if (!value.price || !Number.isFinite(price) || price < 0) {
    errors.price = "กรุณากรอกราคาที่ถูกต้อง";
  }
  else if (price > 0 && price < MIN_PAID_PRICE_BAHT) {
    errors.price = `ราคาขั้นต่ำ ฿${MIN_PAID_PRICE_BAHT} (หรือ 0 สำหรับสินค้าฟรี)`;
  }
  if (
    comparePrice !== null &&
    (!Number.isFinite(comparePrice) || comparePrice <= price)
  ) {
    errors.comparePrice = "ราคาเดิมต้องมากกว่าราคาขาย";
  }
  if (value.deliveryType === "file" && !value.productFile) {
    errors.productFile = "กรุณาอัปโหลดไฟล์สินค้า";
  }
  if (
    value.deliveryType === "key" &&
    value.published &&
    value.keyInventory.available + parseProductKeys(value.keyInput).keys.length === 0
  ) {
    errors.productKeys = "กรุณาเพิ่ม Key อย่างน้อย 1 รายการก่อนเผยแพร่";
  }

  if (value.deliveryType === "course" && !validAccessDays(value.courseAccessDays)) {
    errors.courseAccessDays = "ระบุจำนวนวันเต็ม 1–36500 วัน หรือเลือกตลอดชีพ";
  }

  return errors;
}

/**
 * True when nothing has been filled in yet. A blank new product is what the
 * PDF intake step offers to fill; anything already entered is left alone.
 */
export function isBlankProductValue(value: ProductEditorValue): boolean {
  return (
    !value.name.trim() &&
    !value.price.trim() &&
    !value.comparePrice.trim() &&
    !value.descriptionHtml.replace(/<[^>]*>/g, "").trim() &&
    !value.productFile &&
    value.images.length === 0 &&
    value.highlights.every((item) => !item.trim()) &&
    value.faq.length === 0 &&
    !value.keyInput.trim()
  );
}

export function validateProductFile(file: File): string | null {
  if (file.size > MAX_PRODUCT_FILE_SIZE) {
    return "ไฟล์ต้องมีขนาดไม่เกิน 50 MB";
  }
  return null;
}

export function validateProductImages(
  files: readonly File[],
  occupiedSlots: number,
): ProductImageValidationError[] {
  const errors: ProductImageValidationError[] = [];

  files.forEach((file, index) => {
    if (occupiedSlots + index >= MAX_PRODUCT_IMAGES) {
      errors.push({
        fileName: file.name,
        message: "อัปโหลดรูปสินค้าได้สูงสุด 5 รูป",
      });
    } else if (!IMAGE_TYPES.has(file.type)) {
      errors.push({
        fileName: file.name,
        message: "รองรับเฉพาะ JPG, PNG และ WebP",
      });
    } else if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      errors.push({
        fileName: file.name,
        message: "รูปต้องมีขนาดไม่เกิน 5 MB",
      });
    }
  });

  return errors;
}
