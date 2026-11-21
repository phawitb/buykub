import Link from "next/link";
import type { Purchase, PurchaseProgress, ShopTryout } from "@/lib/purchases/types";
import { ArrowRightIcon, LibraryIcon } from "@/components/icons";

const kindLabels = { course: "คอร์สเรียน", file: "ไฟล์ดิจิทัล", key: "คีย์ / สิทธิ์ใช้งาน", other: "สินค้า" };
const statusLabels = { paid: "ชำระแล้ว", pending: "รอชำระเงิน", refunded: "คืนเงินแล้ว", expired: "หมดอายุ", unavailable: "ยังไม่พร้อมใช้งาน" };
const actionLabels = { course: "เข้าเรียน", file: "เปิดไฟล์ที่ซื้อ", key: "ดูคีย์ที่ซื้อ", other: "ดูรายการ" };
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }) : "—";
}

const tryoutLabels = { course: "เข้าเรียน", file: "เปิดไฟล์", key: "จัดการคีย์" };

function ProgressBar({ progress }: { progress: PurchaseProgress }) {
  return <div className="-mt-2 mb-5"><div className="flex justify-between text-xs text-muted"><span>ทำโจทย์แล้ว</span><span>{progress.answered.toLocaleString("th-TH")} / {progress.total.toLocaleString("th-TH")} ข้อ</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-dim" role="progressbar" aria-label="ความคืบหน้า" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.answered}><div className="h-full rounded-full bg-accent" style={{width:`${Math.min(100, progress.answered / Math.max(1, progress.total) * 100)}%`}}/></div></div>;
}

function ShopTryouts({ tryouts }: { tryouts: ShopTryout[] }) {
  return (
    <section aria-labelledby="shop-tryouts" className="mt-12">
      <h2 id="shop-tryouts" className="text-lg font-semibold text-ink">จากร้านค้าของฉัน</h2>
      <p className="mb-4 mt-2 text-xs leading-6 text-muted">ลองใช้สินค้าของร้านคุณแบบเดียวกับที่ผู้ซื้อได้รับ ไม่มีค่าใช้จ่ายและไม่นับเป็นคำสั่งซื้อ</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tryouts.map(tryout => (
          <article key={tryout.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper">
            {/* Same shape the storefront shows the cover in: whole, never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {tryout.coverUrl && <img src={tryout.coverUrl} alt="" loading="lazy" className="block h-auto w-full border-b border-line bg-paper-dim" />}
            <div className="flex flex-1 flex-col p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-md bg-paper-dim px-2.5 py-1 text-[10px] font-medium text-muted">{kindLabels[tryout.kind]}</span>
              <span className={`text-xs ${tryout.published ? "text-emerald-700" : "text-muted"}`}>{tryout.published ? "เผยแพร่อยู่" : "ยังไม่เผยแพร่"}</span>
            </div>
            <h3 className="mb-6 mt-5 break-words text-lg font-semibold leading-7">{tryout.name}</h3>
            {tryout.progress && <ProgressBar progress={tryout.progress} />}
            {tryout.href ? (
              // The file route answers with a redirect to storage, so it is a plain link.
              tryout.kind === "file"
                ? <a href={tryout.href} className="secondary-button mt-auto inline-flex items-center justify-center gap-2 text-center">{tryoutLabels.file}</a>
                : <Link href={tryout.href} className="secondary-button group mt-auto inline-flex items-center justify-center gap-2 text-center">{tryoutLabels[tryout.kind]}<ArrowRightIcon className="size-4 transition-transform duration-[200ms] ease-out group-hover:translate-x-0.5" /></Link>
            ) : (
              <p className="mt-auto border-t border-line pt-4 text-xs leading-6 text-muted">ยังไม่ได้อัปโหลดไฟล์ของสินค้านี้</p>
            )}
            </div>
          </article>
        ))}
      </div>
      {tryouts.some(tryout => tryout.kind === "key") && <p className="mt-4 text-xs leading-6 text-muted">สินค้าประเภทคีย์ดูได้ในหน้าจัดการสินค้า เพื่อไม่ให้คีย์ที่พร้อมขายถูกใช้ไป</p>}
    </section>
  );
}

export function PurchaseLibrary({ purchases, failed = false, tryouts = [] }: { purchases: Purchase[]; failed?: boolean; tryouts?: ShopTryout[] }) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">รายการที่สั่งซื้อ</h1>
        <p className="mt-3 text-sm leading-7 text-muted">คอร์สเรียน ไฟล์ และคีย์ที่ซื้อไว้ รวมอยู่ในบัญชีของคุณ</p>
      </header>
      {failed ? (
        <section role="alert" className="rounded-2xl border border-line bg-paper-dim/40 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">โหลดรายการที่สั่งซื้อไม่สำเร็จ</h2>
          <p className="mt-3 text-sm leading-7 text-muted">กรุณาลองใหม่อีกครั้ง ระบบยังไม่สามารถตรวจสอบรายการและสิทธิ์ของคุณได้</p>
          {/* A full navigation retries the server read even while already on /learn. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/learn" className="secondary-button mt-6 inline-flex">ลองอีกครั้ง</a>
        </section>
      ) : purchases.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <LibraryIcon className="size-10 text-muted" />
          <h2 className="mt-5 text-xl font-semibold">ยังไม่มีรายการที่สั่งซื้อ</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted">รายการจะแสดงหลังยืนยันการชำระเงิน ใช้บัญชี Google เดียวกับตอนซื้อคอร์ส สำหรับไฟล์และคีย์ที่ซื้อโดยไม่ได้เข้าสู่ระบบ ให้เข้าสู่ระบบด้วยบัญชี Google ที่มีอีเมลตรงกับอีเมลตอนซื้อ</p>
        </section>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">ประวัติการสั่งซื้อ {purchases.length} รายการ</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {purchases.map(purchase => (
              <article key={purchase.id} className="flex flex-col rounded-2xl border border-line bg-paper p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-md bg-paper-dim px-2.5 py-1 text-[10px] font-medium text-muted">{kindLabels[purchase.kind]}</span>
                  <span className={`text-xs ${purchase.status === "paid" ? "text-emerald-700" : "text-muted"}`}>{statusLabels[purchase.status]}</span>
                </div>
                <h2 className="mt-5 break-words text-lg font-semibold leading-7">{purchase.name}</h2>
                <p className="mt-1 text-xs text-muted">{purchase.shopName}</p>
                <div className="mb-6 mt-5 flex items-end justify-between gap-3">
                  <p className="text-xs text-muted">{dateLabel(purchase.purchasedAt)}</p>
                  <p className="text-sm font-semibold">฿{(purchase.priceCents / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</p>
                </div>
                {purchase.kind === "course" && <p className="mb-5 text-xs text-muted">{purchase.expiresAt ? `สิทธิ์ถึง ${dateLabel(purchase.expiresAt)}` : purchase.status === "paid" ? "สิทธิ์ตลอดชีพ" : "สิทธิ์เข้าเรียนไม่พร้อมใช้งาน"}</p>}
                {purchase.progress && <ProgressBar progress={purchase.progress} />}
                {purchase.href && purchase.status === "paid" ? (
                  <Link href={purchase.href} className="primary-button group mt-auto inline-flex items-center justify-center gap-2 text-center">{actionLabels[purchase.kind]}<ArrowRightIcon className="size-4 transition-transform duration-[200ms] ease-out group-hover:translate-x-0.5" /></Link>
                ) : (
                  <p className="mt-auto border-t border-line pt-4 text-xs leading-6 text-muted">{purchase.status === "refunded" ? "รายการนี้คืนเงินแล้ว สิทธิ์เข้าถึงสินค้าสิ้นสุดลง" : purchase.status === "expired" ? "สิทธิ์ของรายการนี้หมดอายุแล้ว" : "ยังไม่สามารถเปิดสินค้าจากรายการนี้ได้"}</p>
                )}
              </article>
            ))}
          </div>
          <p className="mt-6 text-xs leading-6 text-muted">คอร์สผูกกับบัญชี Google ที่ใช้ซื้อ ส่วนไฟล์และคีย์ที่ซื้อโดยไม่ได้เข้าสู่ระบบจะแสดงเมื่ออีเมลตอนซื้อตรงกับอีเมลบัญชี Google นี้</p>
        </>
      )}
      {tryouts.length > 0 && <ShopTryouts tryouts={tryouts} />}
    </div>
  );
}
