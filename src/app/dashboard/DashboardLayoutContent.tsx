import Link from "next/link";
import { DashboardNavigation } from "./DashboardNavigation";
import { SignOutButton } from "./SignOutButton";

type DashboardUser = {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

type DashboardShop = {
  name: string;
  slug: string;
  avatarUrl: string | null;
} | null;

export function DashboardLayoutContent({
  children,
  user,
  shop,
}: {
  children: React.ReactNode;
  user: DashboardUser;
  shop: DashboardShop;
}) {
  const displayName = shop?.name ?? user.fullName ?? user.email ?? "Framelink";
  const avatarUrl = shop?.avatarUrl ?? user.avatarUrl;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-paper-dim px-5 py-6 sm:flex">
        <Link
          href="/dashboard"
          className="mb-10 text-lg font-bold tracking-tight text-ink"
        >
          FRAME<span className="text-muted">LINK</span>
        </Link>

        <DashboardNavigation />

        <div className="mt-auto border-t border-line pt-4">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{displayName}</p>
              {shop?.slug && (
                <p className="mt-0.5 truncate text-[10px] text-muted">
                  framelink.app/{shop.slug}
                </p>
              )}
            </div>
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
