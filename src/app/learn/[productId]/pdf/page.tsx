import Link from "next/link";
import { redirect } from "next/navigation";
import type { CourseAccess } from "@/features/courses/model";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser } from "@/lib/auth";
import { PdfReader } from "@/features/courses/PdfReader";
import { DownloadIcon, LibraryIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Reads the course PDF inside the site; downloading is a separate, deliberate step. */
export default async function CoursePdfPage({params}:{params:Promise<{productId:string}>}) {
  const {productId} = await params;
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user || !isGoogleUser(user)) redirect(`/login?next=${encodeURIComponent(`/learn/${productId}/pdf`)}`);
  const {data:accessData,error:accessError} = await supabase.rpc("course_access",{p_product_id:productId});
  if (accessError) throw new Error("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองใหม่");
  const access = accessData as CourseAccess | null;
  if (!access?.allowed) {
    const reason = access?.reason === "expired" ? "สิทธิ์เข้าเรียนหมดอายุแล้ว" : access?.reason === "refunded" ? "สิทธิ์เข้าเรียนสิ้นสุดเนื่องจากคืนเงินแล้ว" : "บัญชีนี้ยังไม่มีสิทธิ์เปิด PDF ของคอร์สนี้";
    return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 text-center"><LibraryIcon className="mx-auto size-10 text-muted" /><h1 className="mt-6 text-2xl font-bold">{reason}</h1><p className="mt-3 text-sm leading-7 text-muted">ใช้บัญชี Google เดียวกับที่ซื้อคอร์ส</p><Link href="/learn" className="primary-button mt-6">รายการที่สั่งซื้อ</Link></main>;
  }
  const {data:product} = await supabase.from("products").select("name").eq("id",productId).maybeSingle<{name:string}>();
  const file = `/api/courses/${encodeURIComponent(productId)}/pdf`;
  return (
    <main className="min-h-screen bg-paper-dim">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur lg:px-8">
        <Link href="/learn" className="shrink-0 text-sm font-semibold">‹ รายการที่สั่งซื้อ</Link>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{product?.name ?? "PDF ประกอบคอร์ส"}</span>
        <a href={file} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-4 text-xs font-medium text-white transition hover:bg-red-700"><DownloadIcon className="size-4" />ดาวน์โหลด</a>
      </header>
      <PdfReader src={`${file}?view=1`} />
    </main>
  );
}
