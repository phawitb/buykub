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

export type ProductUploadRecord = {
  path: string;
  fileName: string;
  size: number;
  mimeType: string;
};

export type ProductDeliveryType = "file" | "key";

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
  keyInput: string;
  keyInventory: ProductKeyInventorySummary;
  name: string;
  price: string;
  comparePrice: string;
  category: string;
  descriptionHtml: string;
  productFile: ProductUploadRecord | null;
  images: ProductImage[];
  highlights: string[];
  faq: ProductFAQ[];
  published: boolean;
};

export type ProductFieldErrors = Partial<
  Record<"name" | "price" | "comparePrice" | "productFile" | "productKeys", string>
>;

export type ProductImageValidationError = {
  fileName: string;
  message: string;
};
