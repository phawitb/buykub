import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNavigation } from "./DashboardNavigation";
import { SignOutButton } from "./SignOutButton";

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
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-paper-dim px-5 py-6 sm:flex">
        <Link href="/" className="mb-10 text-lg font-bold tracking-tight text-ink">
          FRAME<span className="text-muted">LINK</span>
        </Link>

        <DashboardNavigation />

        <Link
          href="/dashboard/settings/upgrade"
          className="mb-4 rounded-2xl border border-line bg-paper p-4 text-xs transition hover:border-ink"
        >
          <p className="font-semibold text-ink">อัปเกรดเป็น Pro</p>
          <p className="mt-1 leading-5 text-muted">
            ค่าธรรมเนียมลดเหลือ 2% + ปิด watermark
          </p>
        </Link>

        <div className="border-t border-line pt-4">
          <div className="flex items-center gap-3">
          {shop?.avatar_url ?? user.user_metadata?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop?.avatar_url ?? user.user_metadata.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
              {(shop?.name ?? user.email ?? "F").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">
              {shop?.name ?? user.user_metadata?.full_name ?? user.email}
            </p>
            {shop?.slug && (
              <p className="mt-0.5 truncate text-[10px] text-muted">
                framelink.app/{shop.slug}
              </p>
            )}
          </div>
          <Link
            href="/dashboard/settings/upgrade"
            className="rounded-full bg-paper-dim px-2 py-1 text-[10px] font-semibold text-ink"
          >
            Free
          </Link>
          </div>
          <div className="mt-3">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-paper px-5 py-7 pb-28 sm:px-10 sm:py-9 sm:pb-9">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <DashboardNavigation mobile />
      </div>
    </div>
  );
}
