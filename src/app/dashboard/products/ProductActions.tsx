"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductAsset } from "@/features/products/asset-cleanup";
import { createClient } from "@/lib/supabase/client";
import { deleteShopAsset, type UploadDestination } from "@/lib/supabase/upload";

type Props = {
  productId: string;
  shopId: string;
  productName: string;
  published: boolean;
  assets: ProductAsset[];
  deleteProduct?: () => Promise<void>;
  deleteAsset?: (destination: UploadDestination, path: string) => Promise<void>;
};

export function ProductActions({
  productId,
  shopId,
  productName,
  published,
  assets,
  deleteProduct,
  deleteAsset = deleteShopAsset,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function togglePublished() {
    setBusy("publish");
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("products")
      .update({ published: !published })
      .eq("id", productId)
      .eq("shop_id", shopId);
    if (updateError) {
      setError(`เปลี่ยนสถานะไม่สำเร็จ: ${updateError.message}`);
      setBusy(null);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      if (deleteProduct) {
        await deleteProduct();
      } else {
        const supabase = createClient();
        const { error: deleteError } = await supabase
          .from("products")
          .delete()
          .eq("id", productId)
          .eq("shop_id", shopId);
        if (deleteError) throw deleteError;
      }
    } catch (deleteError) {
      setError(
        `ลบสินค้าไม่สำเร็จ: ${
          deleteError instanceof Error ? deleteError.message : "กรุณาลองอีกครั้ง"
        }`,
      );
      setBusy(null);
      return;
    }
    await Promise.allSettled(
      assets.map((asset) => deleteAsset(asset.destination, asset.path)),
    );
    setConfirmingDelete(false);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void togglePublished()}
        className="small-button"
        aria-label={published ? "ยกเลิกเผยแพร่" : "เผยแพร่สินค้า"}
      >
        {busy === "publish"
          ? "กำลังบันทึก..."
          : published
            ? "ยกเลิกเผยแพร่"
            : "เผยแพร่"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => setConfirmingDelete(true)}
        className="small-button text-red-600"
        aria-label="ลบสินค้า"
      >
        ลบ
      </button>

      {error && (
        <p className="basis-full text-right text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {confirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-title-${productId}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-5"
        >
          <div className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-2xl">
            <h2
              id={`delete-title-${productId}`}
              className="text-lg font-bold text-ink"
            >
              ลบสินค้านี้?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              “{productName}” จะหายจากหน้าร้านและไม่สามารถกู้คืนได้
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmingDelete(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={busy === "delete"}
                onClick={() => void remove()}
              >
                {busy === "delete" ? "กำลังลบ..." : "ลบสินค้า"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
