import type {
  ProductEditorValue,
  ProductFieldErrors,
  ProductImageValidationError,
} from "@/features/products/model";

export const MAX_PRODUCT_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 5;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  if (
    comparePrice !== null &&
    (!Number.isFinite(comparePrice) || comparePrice <= price)
  ) {
    errors.comparePrice = "ราคาเดิมต้องมากกว่าราคาขาย";
  }
  if (!value.productFile) errors.productFile = "กรุณาอัปโหลดไฟล์สินค้า";

  return errors;
}

export function validateProductFile(file: File): string | null {
  if (file.size > MAX_PRODUCT_FILE_SIZE) {
    return "ไฟล์ต้องมีขนาดไม่เกิน 500 MB";
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
