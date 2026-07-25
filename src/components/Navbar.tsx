import Link from "next/link";
import { ProfileMenu } from "./ProfileMenu";

type NavUser = {
  name: string;
  avatarUrl: string | null;
};

export function Navbar({ user }: { user?: NavUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">
          FRAME<span className="text-muted">LINK</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <ProfileMenu name={user.name} avatarUrl={user.avatarUrl} />
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:opacity-85"
              >
                สร้างร้านฟรี
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
