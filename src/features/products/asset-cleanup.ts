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

  const currentPreviewPaths = new Set((current.previews ?? []).map((preview) => preview.path));
  const currentSourcePaths = new Set((current.previews ?? []).map((preview) => preview.sourcePath));
  (initial.previews ?? []).forEach((preview) => {
    if (!currentPreviewPaths.has(preview.path)) {
      removed.push({ destination: "product-image", path: preview.path });
    }
    if (preview.sourcePath && !currentSourcePaths.has(preview.sourcePath)) {
      removed.push({ destination: "product-file", path: preview.sourcePath });
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

  const initialPreviewPaths = new Set((initial.previews ?? []).map((preview) => preview.path));
  const initialSourcePaths = new Set((initial.previews ?? []).map((preview) => preview.sourcePath));
  (current.previews ?? []).forEach((preview) => {
    if (!initialPreviewPaths.has(preview.path)) {
      added.push({ destination: "product-image", path: preview.path });
    }
    if (preview.sourcePath && !initialSourcePaths.has(preview.sourcePath)) {
      added.push({ destination: "product-file", path: preview.sourcePath });
    }
  });

  return added;
}
