import { notFound } from "next/navigation";
import { CurriculumEditor } from "@/features/courses/CurriculumEditor";
import { CourseFormatSwitch } from "@/features/courses/CourseFormatSwitch";
import { ExamPackManager } from "@/features/courses/exam-prep/ExamPackManager";
import { readExamSummary } from "@/features/courses/exam-prep/pack";
import type { CourseLesson } from "@/features/courses/model";
import { getSellerContext } from "@/lib/supabase/seller-context";
import { isMissingColumnError } from "@/lib/supabase/missing-column";

export default async function LessonsPage({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const { supabase, user, shop } = await getSellerContext();
  if (!shop) notFound();
  const readProduct = (fields: string) => supabase.from("products").select(fields).eq("id",id).eq("shop_id",shop.id).eq("delivery_type","course")
    .maybeSingle<{id:string;name:string;published:boolean;course_format?:string;exam_summary?:unknown}>();
  const first = await readProduct("id,name,published,course_format,exam_summary");
  // Before the exam-prep migration every course is a lesson course.
  const {data:product} = isMissingColumnError(first.error,"course_format") ? await readProduct("id,name,published") : first;
  if (!product) notFound();
  const format = product.course_format === "exam_prep" ? "exam_prep" : "lessons";
  const formatSwitch = <CourseFormatSwitch productId={id} format={format} published={product.published}/>;
  if (format === "exam_prep") return <>{formatSwitch}<ExamPackManager productId={id} productName={product.name} userId={user.id} summary={readExamSummary(product.exam_summary)} published={product.published}/></>;
  const {data:lessons,error} = await supabase.from("course_lessons").select("id,title,position,content_html,youtube_url,documents,published").eq("product_id",id).order("position");
  if(error) throw new Error("โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่");
  return <>{formatSwitch}<CurriculumEditor productId={id} productName={product.name} userId={user.id} initialLessons={(lessons ?? []) as CourseLesson[]} published={product.published}/></>;
}
