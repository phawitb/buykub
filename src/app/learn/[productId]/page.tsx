import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseReader } from "@/features/courses/CourseReader";
import { ExamPrepClassroom } from "@/features/courses/exam-prep/ExamPrepClassroom";
import type { CourseAccess, CourseLesson } from "@/features/courses/model";
import { sanitizeLessonHtml } from "@/features/courses/sanitize";
import { normalizeYoutubeUrl } from "@/features/products/components/rich-text-urls";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser } from "@/lib/auth";
import { isMissingColumnError } from "@/lib/supabase/missing-column";
import { LibraryIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export default async function LearnCoursePage({params}:{params:Promise<{productId:string}>}) {
  const {productId} = await params;
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user || !isGoogleUser(user)) redirect(`/login?next=${encodeURIComponent(`/learn/${productId}`)}`);
  const {data:accessData,error:accessError} = await supabase.rpc("course_access",{p_product_id:productId});
  if (accessError) throw new Error("ตรวจสอบสิทธิ์เข้าเรียนไม่สำเร็จ กรุณาลองใหม่");
  const access = accessData as CourseAccess | null;
  if (!access?.allowed) {
    const reason = access?.reason === "expired" ? "สิทธิ์เข้าเรียนหมดอายุแล้ว" : access?.reason === "refunded" ? "สิทธิ์เข้าเรียนสิ้นสุดเนื่องจากคืนเงินแล้ว" : "บัญชีนี้ยังไม่มีสิทธิ์เข้าเรียน";
    return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 text-center"><LibraryIcon className="mx-auto size-10 text-muted" /><h1 className="mt-6 text-2xl font-bold">{reason}</h1><p className="mt-3 text-sm leading-7 text-muted">ใช้บัญชี Google เดียวกับที่ซื้อคอร์ส หากเพิ่งชำระเงินแล้ว กรุณารอการยืนยันและเปิดหน้านี้อีกครั้ง</p><Link href="/learn" className="primary-button mt-6">รายการที่สั่งซื้อ</Link></main>;
  }
  // Authorization precedes every material query; lesson RLS independently enforces buyer/owner access.
  const readProduct = (fields: string) => supabase.from("products").select(fields).eq("id",productId).maybeSingle<{name:string;course_format?:string}>();
  let {data:product,error:productError} = await readProduct("name,course_format");
  // Before the exam-prep migration every course is a lesson course.
  if (isMissingColumnError(productError,"course_format")) ({data:product,error:productError} = await readProduct("name"));
  if (productError) throw new Error("โหลดคอร์สไม่สำเร็จ กรุณาลองใหม่");
  const name = product?.name ?? "คอร์สเรียน";
  // The exam-prep pack is fetched by the classroom from an entitlement-checked route; no storage path reaches the client.
  if (product?.course_format === "exam_prep") return <ExamPrepClassroom productId={productId} name={name} expiresAt={access.expires_at} owner={access.reason === "owner"}/>;
  const {data:lessonRows,error:lessonError} = await supabase.from("course_lessons").select("id,title,position,content_html,youtube_url,documents,published").eq("product_id",productId).eq("published",true).order("position");
  if (lessonError) throw new Error("โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่");
  const lessons = ((lessonRows ?? []) as CourseLesson[]).map(lesson => ({
    id:lesson.id, title:lesson.title, content_html:sanitizeLessonHtml(lesson.content_html),
    youtube_url:lesson.youtube_url ? normalizeYoutubeUrl(lesson.youtube_url) : null,
    // Never expose storage paths or external document targets to the client payload.
    documents:(lesson.documents ?? []).map(doc => ({id:doc.id,name:doc.name})),
  }));
  return <CourseReader productId={productId} name={name} lessons={lessons} expiresAt={access.expires_at} owner={access.reason === "owner"}/>;
}
