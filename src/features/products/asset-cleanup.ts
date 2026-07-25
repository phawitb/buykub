import type { ProductEditorValue } from "@/features/products/model";
import type { UploadDestination } from "@/lib/supabase/upload";

export type ProductAsset = {
  destination: UploadDestination;
  path: string;
};

export function findRemovedProductAssets(
  initial: ProductEditorValue,
  current: ProductEditorValue,
): ProductAsset[] {
  const removed: ProductAsset[] = [];

  if (
    initial.productFile &&
    initial.productFile.path !== current.productFile?.path
  ) {
    removed.push({
      destination: "product-file",
      path: initial.productFile.path,
    });
  }

  const currentImagePaths = new Set(current.images.map((image) => image.path));
  initial.images.forEach((image) => {
    if (!currentImagePaths.has(image.path)) {
      removed.push({ destination: "product-image", path: image.path });
    }
  });

  return removed;
}

export function findNewProductAssets(
  initial: ProductEditorValue,
  current: ProductEditorValue,
): ProductAsset[] {
  const added: ProductAsset[] = [];

  if (
    current.productFile &&
    current.productFile.path !== initial.productFile?.path
  ) {
    added.push({
      destination: "product-file",
      path: current.productFile.path,
    });
  }

  const initialImagePaths = new Set(initial.images.map((image) => image.path));
  current.images.forEach((image) => {
    if (!initialImagePaths.has(image.path)) {
      added.push({ destination: "product-image", path: image.path });
    }
  });

  return added;
}
