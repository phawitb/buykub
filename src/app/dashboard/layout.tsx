import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayoutContent } from "./DashboardLayoutContent";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("name, slug, avatar_url")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <DashboardLayoutContent
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
