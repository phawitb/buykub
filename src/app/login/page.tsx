import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { EmailLoginForm } from "./EmailLoginForm";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string }>;
}) {
  const { next, error, reason } = await searchParams;
  const destination = next ?? "/dashboard";

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink px-10 py-10 text-paper lg:flex xl:px-16">
        <Link href="/">
          <BrandLogo className="text-xl" />
        </Link>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            Biolink ที่ขายได้จริง
          </p>
          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
            แปะลิงก์
            <br />
            ขายได้เลย
          </h1>
          <p className="mt-4 max-w-sm text-sm text-paper/70">
            ตั้งร้านออนไลน์ในลิงก์เดียว ขายของดิจิทัลหรือเปิดจองคิว เริ่มได้ในไม่กี่นาที
          </p>
        </div>

        <p className="text-xs text-paper/40">© 2026 {BRAND_NAME}</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-sm">
          <h2 className="text-xl font-bold text-ink">เริ่มต้นใช้ {BRAND_NAME}</h2>
          <p className="mt-1.5 text-sm text-muted">
            ใส่อีเมลเพื่อสร้างร้านหรือเข้าสู่ระบบ
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-line bg-paper-dim px-3 py-2 text-xs text-ink-soft">
              {reason === "exchange"
                ? "ลิงก์เข้าสู่ระบบหมดอายุหรือถูกใช้แล้ว กรุณาเริ่มเข้าสู่ระบบอีกครั้ง"
                : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง"}
            </p>
          )}

          <div className="mt-6">
            <EmailLoginForm next={destination} />
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            <span>หรือ</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div>
            <GoogleButton next={destination} />
          </div>

          <p className="mt-5 text-center text-xs text-muted">
            ยังไม่มีบัญชี?{" "}
            <Link
              href={`/login?next=${encodeURIComponent("/dashboard/settings")}`}
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
