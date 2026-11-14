import { notFound } from "next/navigation";
import { CurriculumEditor } from "@/features/courses/CurriculumEditor";
import type { CourseLesson } from "@/features/courses/model";
import { getSellerContext } from "@/lib/supabase/seller-context";

export default async function LessonsPage({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const { supabase, user, shop } = await getSellerContext();
  if (!shop) notFound();
  const {data:product} = await supabase.from("products").select("id,name,published").eq("id",id).eq("shop_id",shop.id).eq("delivery_type","course").maybeSingle();
  if (!product) notFound();
  const {data:lessons,error} = await supabase.from("course_lessons").select("id,title,position,content_html,youtube_url,documents,published").eq("product_id",id).order("position");
  if(error) throw new Error("โหลดบทเรียนไม่สำเร็จ กรุณาลองใหม่");
  return <CurriculumEditor productId={id} productName={product.name} userId={user.id} initialLessons={(lessons ?? []) as CourseLesson[]} published={product.published}/>;
}
