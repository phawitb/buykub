"use client";

import { invalidatePublicCatalog, CATALOG_REFRESH_WARNING } from "@/lib/storefront/invalidate";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExternalIcon, LibraryIcon } from "@/components/icons";
import { EXAM_PACK_MAX_BYTES, examPackPath, summarizeExamPack, validateExamPack, type ExamPack, type ExamSummary } from "./pack";

const message = (error: unknown) => typeof error === "object" && error && "message" in error ? String(error.message) : "กรุณาลองอีกครั้ง";

/** Seller view of an exam-prep course: one pack.json replaces the lesson editor. */
export function ExamPackManager({productId, productName, userId, summary, published}:{productId:string;productName:string;userId:string;summary:ExamSummary|null;published:boolean}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"upload"|"publish"|null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setErrors([]); setNotice("");
    if (file.size > EXAM_PACK_MAX_BYTES) { setErrors(["ไฟล์ใหญ่เกิน 20 MB"]); return; }
    let pack: unknown;
    try { pack = JSON.parse(await file.text()); } catch { setErrors(["อ่านไฟล์ไม่ได้ ต้องเป็น pack.json ที่สร้างจาก build_pack.py"]); return; }
    const problems = validateExamPack(pack);
    if (problems.length) { setErrors(problems); return; }
    if (summary && (pack as ExamPack).id !== summary.id) { setErrors([`แพ็กนี้เป็นของคอร์ส "${(pack as ExamPack).id}" ไม่ใช่ "${summary.id}" ความคืบหน้าของผู้เรียนจะไม่ตรงกัน ให้สร้างสินค้าใหม่สำหรับคอร์สอื่น`]); return; }
    setBusy("upload");
    try {
      const supabase = createClient();
      const {error: uploadError} = await supabase.storage.from("product-files").upload(examPackPath(userId, productId), new Blob([JSON.stringify(pack)], {type:"application/json"}), {upsert:true, contentType:"application/json"});
      if (uploadError) throw uploadError;
      const {error: summaryError} = await supabase.from("products").update({exam_summary:summarizeExamPack(pack as ExamPack), updated_at:new Date().toISOString()}).eq("id",productId);
      if (summaryError) throw summaryError;
      if (published && !(await invalidatePublicCatalog())) setErrors([CATALOG_REFRESH_WARNING]);
      setNotice(summary ? "อัปเดตเนื้อหาแล้ว ผู้เรียนจะเห็นฉบับใหม่เมื่อเปิดห้องเรียนครั้งถัดไป" : "อัปโหลดเนื้อหาแล้ว");
      router.refresh();
    } catch (error) { setErrors([`อัปโหลดไม่สำเร็จ: ${message(error)}`]); }
    finally { setBusy(null); }
  }

  async function publish() {
    setBusy("publish"); setErrors([]); setNotice("");
    const {error} = await createClient().from("products").update({published:true}).eq("id",productId);
    if (error) setErrors([error.message.includes("course_not_ready") ? "อัปโหลดแพ็กเนื้อหาก่อนเปิดขาย" : `เผยแพร่ไม่สำเร็จ: ${error.message}`]);
    else {
      if (!(await invalidatePublicCatalog())) setErrors([CATALOG_REFRESH_WARNING]);
      setNotice("เผยแพร่คอร์สแล้ว"); router.refresh();
    }
    setBusy(null);
  }

  return <div className="mx-auto max-w-4xl">
    <Link href={`/dashboard/products/${productId}/edit`} className="text-sm text-muted hover:text-ink">‹ ข้อมูลสินค้า</Link>
    <div className="my-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-ink">{productName}</h1><p className="mt-2 text-sm text-muted">คอร์สติวสอบ: แผนอ่านรายวัน สรุปบทเรียน ฝึกโจทย์ และข้อสอบจำลองจับเวลา ในห้องเรียนเดียว</p></div>
      {summary && <Link href={`/learn/${productId}`} target="_blank" className="secondary-button inline-flex items-center gap-1.5">ดูตัวอย่างห้องเรียน<ExternalIcon className="size-3.5" /></Link>}
    </div>

    <section className="rounded-2xl border border-line bg-paper p-5 sm:p-8">
      {summary ? <>
        <p className="text-xs font-semibold tracking-widest text-muted">เนื้อหาปัจจุบัน</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">{summary.title}</h2>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[["แผนอ่าน",`${summary.days} วัน`],["คลังข้อสอบ",`${summary.questions.toLocaleString("th-TH")} ข้อ`],["ข้อสอบจำลอง",`${summary.mocks} ชุด × ${summary.mockQuestions} ข้อ`],["สรุปบทเรียน",`${summary.chapters} บท`]].map(([label,value]) =>
            <div key={label} className="rounded-xl bg-paper-dim/60 p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-semibold text-ink">{value}</dd></div>)}
        </dl>
        <ul className="mt-5 flex flex-wrap gap-2">{summary.subjects.map(subject => <li key={subject.key} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft">{subject.name} · {subject.questions} ข้อ</li>)}</ul>
      </> : <div className="flex flex-col items-center py-8 text-center"><LibraryIcon className="size-10 text-muted" /><h2 className="mt-4 text-lg font-semibold">ยังไม่มีเนื้อหา</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted">อัปโหลด pack.json ที่สร้างจากชุดติว ระบบจะตรวจโครงสร้างก่อนรับ และเก็บเป็นไฟล์ส่วนตัวที่เปิดได้เฉพาะผู้ซื้อ</p></div>}
      <label className="mt-6 block border-t border-line pt-6 text-sm font-semibold">{summary ? "แทนที่ด้วยแพ็กใหม่" : "เลือกไฟล์ pack.json"}
        <input type="file" accept="application/json,.json" disabled={busy !== null} className="mt-2 block w-full text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-paper-dim file:px-4 file:py-2" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }}/>
        <span className="mt-2 block text-xs font-normal text-muted">ความคืบหน้าของผู้เรียนผูกกับรหัสข้อ จึงแทนที่ด้วยแพ็กเวอร์ชันใหม่ของคอร์สเดิมได้ ไม่ควรใช้แพ็กของคอร์สอื่น</span>
      </label>
    </section>

    {busy === "upload" && <p role="status" className="mt-4 text-sm">กำลังอัปโหลด…</p>}
    {errors.length > 0 && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{errors.map((error,index) => <p key={index}>{error}</p>)}</div>}
    {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
    {!published && <div className="sticky bottom-0 mt-5 flex items-center justify-end gap-3 border-t border-line bg-paper/95 p-4 backdrop-blur"><span className="mr-auto text-xs text-muted">คอร์สยังเป็นแบบร่าง</span><button type="button" disabled={busy !== null || !summary} onClick={() => void publish()} className="primary-button">{busy === "publish" ? "กำลังเผยแพร่…" : "เผยแพร่คอร์ส"}</button></div>}
  </div>;
}
