"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type CourseFormat = "lessons" | "exam_prep";
const FORMATS: {value: CourseFormat; title: string; description: string}[] = [
  {value:"lessons", title:"บทเรียน", description:"เขียนบทเรียน แนบวิดีโอและเอกสารเอง"},
  {value:"exam_prep", title:"คอร์สติวสอบ", description:"อัปโหลดแพ็กเนื้อหา ได้แผนรายวัน ฝึกโจทย์ และข้อสอบจำลอง"},
];

/** Chooses how this course is delivered. Published courses keep their format so buyers never land on an empty classroom. */
export function CourseFormatSwitch({productId, format, published}:{productId:string;format:CourseFormat;published:boolean}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function choose(next: CourseFormat) {
    if (next === format || saving) return;
    setSaving(true); setError("");
    const {error: updateError} = await createClient().from("products").update({course_format:next}).eq("id",productId);
    if (updateError) setError(`เปลี่ยนรูปแบบไม่สำเร็จ: ${updateError.message}`);
    else router.refresh();
    setSaving(false);
  }
  return <fieldset className="mx-auto mb-6 max-w-6xl" disabled={saving || published}>
    <legend className="text-xs font-semibold text-muted">รูปแบบคอร์ส{published && " · ปิดการขายก่อนจึงเปลี่ยนได้"}</legend>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{FORMATS.map(option => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition has-[:disabled]:cursor-default ${option.value === format ? "border-accent bg-accent-soft" : "border-line bg-paper hover:border-ink-soft"}`}>
      <input type="radio" name="course-format" className="mt-1" checked={option.value === format} onChange={() => void choose(option.value)}/>
      <span><span className="block font-semibold text-ink">{option.title}</span><span className="mt-0.5 block text-xs text-muted">{option.description}</span></span>
    </label>)}</div>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
  </fieldset>;
}
