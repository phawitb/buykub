export type ProductFAQ = {
  id: string;
  question: string;
  answer: string;
};

export type ProductImage = {
  id: string;
  path: string;
  publicUrl: string;
  alt: string;
};

/**
 * A sample image shown under "สิ่งที่คุณจะได้รับ". The blur and the watermark
 * are drawn into the uploaded file itself, so the flags only record what was
 * applied; the clean original is never uploaded.
 */
export type ProductPreviewImage = {
  id: string;
  path: string;
  publicUrl: string;
  width: number;
  height: number;
  blur: boolean;
  watermark: boolean;
};

export type ProductUploadRecord = {
  path: string;
  fileName: string;
  size: number;
  mimeType: string;
  /** Pages in the file, for a PDF; unknown for anything else. */
  pageCount?: number | null;
};

export type ProductDeliveryType = "file" | "key" | "course";

export type ProductKeyInventorySummary = {
  available: number;
  assigned: number;
  disabled: number;
};

export type ProductKeyRecord = {
  id: string;
  keyValue: string;
  status: "available" | "assigned" | "disabled";
  assignedOrderId: string | null;
  createdAt: string;
};

export type ProductEditorValue = {
  deliveryType: ProductDeliveryType;
  courseAccessDays?: string;
  keyInput: string;
  keyInventory: ProductKeyInventorySummary;
  name: string;
  price: string;
  comparePrice: string;
  category: string;
  descriptionHtml: string;
  productFile: ProductUploadRecord | null;
  images: ProductImage[];
  /** Sample images under the highlights. Absent on values built before previews existed. */
  previews?: ProductPreviewImage[];
  highlights: string[];
  faq: ProductFAQ[];
  published: boolean;
};

export type ProductFieldErrors = Partial<
  Record<"name" | "price" | "comparePrice" | "productFile" | "productKeys" | "courseAccessDays", string>
>;

export type ProductImageValidationError = {
  fileName: string;
  message: string;
};
