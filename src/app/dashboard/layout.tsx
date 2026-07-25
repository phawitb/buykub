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

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-paper-dim px-5 py-6 sm:flex">
        <Link href="/" className="mb-10 text-lg font-bold tracking-tight text-ink">
          FRAME<span className="text-muted">LINK</span>
        </Link>

        <DashboardNavigation />

        <Link
          href="/dashboard/settings"
          className="mb-4 flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-xs"
        >
          <span className="font-medium text-ink-soft">แพลนปัจจุบัน</span>
          <span className="rounded-full bg-paper-dim px-2 py-0.5 font-semibold text-ink">
            Free
          </span>
        </Link>

        <div className="flex items-center gap-3 border-t border-line pt-4">
          {user.user_metadata?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-ink" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">
              {user.user_metadata?.full_name ?? user.email}
            </p>
          </div>
          <SignOutButton />
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
