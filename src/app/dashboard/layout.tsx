import { getSellerContext } from "@/lib/supabase/seller-context";
import { DashboardLayoutContent } from "./DashboardLayoutContent";
import { isPlatformAdminUser } from "@/lib/admin/access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, shop } = await getSellerContext();

  return (
    <DashboardLayoutContent
      isAdmin={isPlatformAdminUser(user)}
      user={{
        email: user.email ?? null,
        fullName: user.user_metadata?.full_name ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      }}
      shop={
        shop
          ? { name: shop.name, slug: shop.slug, avatarUrl: shop.avatar_url }
          : null
      }
    >
      {children}
    </DashboardLayoutContent>
  );
}
