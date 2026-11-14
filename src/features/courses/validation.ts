import { normalizeYoutubeUrl } from "@/features/products/components/rich-text-urls";
import type { CourseLesson } from "./model";

export function normalizeDocumentUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}
export function validAccessDays(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 36500;
}
export function validateCourseLessons(lessons: CourseLesson[], ownerId: string): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (lessons.length > 100) errors.push("เพิ่มได้สูงสุด 100 บทเรียน");
  for (const [index, lesson] of lessons.entries()) {
    const label = `บทที่ ${index + 1}`;
    if (!uuid.test(lesson.id) || ids.has(lesson.id)) errors.push(`${label}: รหัสบทเรียนไม่ถูกต้องหรือซ้ำ`);
    ids.add(lesson.id);
    if (!lesson.title.trim() || lesson.title.length > 200) errors.push(`${label}: ชื่อบทเรียนต้องมี 1–200 ตัวอักษร`);
    if (lesson.content_html.length > 100000) errors.push(`${label}: เนื้อหายาวเกินไป`);
    if (lesson.youtube_url && !normalizeYoutubeUrl(lesson.youtube_url)) errors.push(`${label}: ใช้ลิงก์ YouTube ที่ถูกต้อง`);
    if (lesson.documents.length > 20) errors.push(`${label}: แนบเอกสารได้สูงสุด 20 รายการ`);
    for (const doc of lesson.documents) {
      if (!uuid.test(doc.id) || ids.has(doc.id) || !doc.name.trim() || doc.name.length > 200 || Boolean(doc.path) === Boolean(doc.url) ||
        (doc.path && (!doc.path.startsWith(`${ownerId}/`) || doc.path.includes(".."))) ||
        (doc.url && !normalizeDocumentUrl(doc.url))) errors.push(`${label}: เอกสารไม่ถูกต้อง`);
      ids.add(doc.id);
    }
  }
  return errors;
}
