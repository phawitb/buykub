import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { isGoogleUser, safeAuthRedirect } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string; reason?: string }>;
}) {
  const { next, error, reason } = await searchParams;
  const destination = safeAuthRedirect(typeof next === "string" ? next : undefined);
  // Verify the current request's cookies; never cache a user's login decision.
  let signedInWithGoogle = false;
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    signedInWithGoogle = !authError && isGoogleUser(data.user);
  } catch {
    // A failed session check must leave sign-in available.
  }
  if (signedInWithGoogle) redirect(destination);

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink px-10 py-10 text-paper lg:flex xl:px-16">
        <Link href="/">
          <BrandLogo className="text-xl" />
        </Link>

        <div>
          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
            แปะลิงก์
            <br />
            ขายได้เลย
          </h1>
          <p className="mt-4 max-w-sm text-sm text-on-ink-soft">
            ตั้งร้านออนไลน์ในลิงก์เดียว ขายสินค้าดิจิทัลและคอร์สออนไลน์ เริ่มได้ในไม่กี่นาที
          </p>
        </div>

        <p className="text-xs text-on-ink-soft">© 2026 {BRAND_NAME}</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-lift-1">
          <h2 className="text-xl font-bold text-ink">เริ่มต้นใช้ {BRAND_NAME}</h2>
          <p className="mt-1.5 text-sm text-muted">
            ใช้บัญชี Google เพื่อซื้อสินค้า ดูรายการที่สั่งซื้อ หรือเปิดร้านของคุณ
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-line bg-paper-dim px-3 py-2 text-xs text-ink-soft">
              {reason === "google_required"
                ? "กรุณาเข้าสู่ระบบด้วยบัญชี Google เพื่อใช้งาน BUYKUB"
                : reason === "exchange"
                ? "ลิงก์เข้าสู่ระบบหมดอายุหรือถูกใช้แล้ว กรุณาเริ่มเข้าสู่ระบบอีกครั้ง"
                : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง"}
            </p>
          )}

          <div className="mt-6">
            <GoogleButton next={destination} />
          </div>

          <p className="mt-5 text-center text-xs text-muted">
            อยากขายสินค้าของคุณ?{" "}
            <Link
              href={`/login?next=${encodeURIComponent("/dashboard/products?create=1")}`}
              className="font-semibold text-ink underline underline-offset-4"
            >
              สร้างร้านฟรี
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
