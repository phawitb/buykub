// Never fail the database mutation merely because a cache refresh is unavailable.
export async function invalidatePublicCatalog(): Promise<boolean> {
  try {
    const response = await fetch("/api/storefront/revalidate", {
      method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch { return false; }
}
export const CATALOG_REFRESH_WARNING = "บันทึกแล้ว แต่หน้าร้านอาจยังแสดงข้อมูลเดิมชั่วคราว กรุณาลองบันทึกอีกครั้งเพื่ออัปเดตหน้าร้าน";
