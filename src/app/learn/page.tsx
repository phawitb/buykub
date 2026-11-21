import { DashboardLayoutContent } from "@/app/dashboard/DashboardLayoutContent";
import { PurchaseLibrary } from "@/features/purchases/PurchaseLibrary";
import { getPurchaseLibrary, getShopTryouts } from "@/lib/purchases/library";
import type { Purchase, ShopTryout } from "@/lib/purchases/types";
import { getSellerContext } from "@/lib/supabase/seller-context";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const { user, shop } = await getSellerContext();
  let purchases: Purchase[] = [];
  let failed = false;
  try {
    purchases = await getPurchaseLibrary();
  } catch {
    failed = true;
  }
  // The seller's own products are a convenience; their failure never hides purchases.
  const tryouts: ShopTryout[] = await getShopTryouts().catch(() => []);

  // Only the library shares workspace navigation; the classroom stays standalone.
  return (
    <DashboardLayoutContent
      user={{ email: user.email ?? null, fullName: user.user_metadata?.full_name ?? null, avatarUrl: user.user_metadata?.avatar_url ?? null }}
      shop={shop ? { name: shop.name, slug: shop.slug, avatarUrl: shop.avatar_url } : null}
    >
      <PurchaseLibrary purchases={purchases} failed={failed} tryouts={tryouts} />
    </DashboardLayoutContent>
  );
}
