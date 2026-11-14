const CATEGORY_LABELS = {
  COURSE: "Course",
  FILE: "File",
} as const;

// Legacy keys retain their delivery and inventory rules within the File category.
export function productCategory(deliveryType?: string | null) {
  return deliveryType === "course" ? "COURSE" : "FILE";
}

export function productCategoryLabel(deliveryType?: string | null) {
  return CATEGORY_LABELS[productCategory(deliveryType)];
}
