import Link from "next/link";
import { GoogleButton } from "./GoogleButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink px-10 py-10 text-paper lg:flex xl:px-16">
        <Link href="/" className="text-xl font-bold tracking-tight">
          FRAME<span className="text-muted">LINK</span>
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

        <p className="text-xs text-paper/40">© 2026 Framelink</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-sm">
          <h2 className="text-xl font-bold text-ink">เริ่มต้นใช้ Framelink</h2>
          <p className="mt-1.5 text-sm text-muted">
            เข้าสู่ระบบด้วยบัญชี Google เพื่อสร้างหรือจัดการร้านของคุณ
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-line bg-paper-dim px-3 py-2 text-xs text-ink-soft">
              เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้ง
            </p>
          )}

          <div className="mt-6">
            <GoogleButton next={next ?? "/dashboard"} />
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            การเข้าสู่ระบบถือว่ายอมรับข้อกำหนดการใช้งานของเรา
          </p>
        </div>
      </div>
    </div>
  );
}
