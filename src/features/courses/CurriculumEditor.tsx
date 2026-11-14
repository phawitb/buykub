"use client";

import { invalidatePublicCatalog, CATALOG_REFRESH_WARNING } from "@/lib/storefront/invalidate";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/features/products/components/RichTextEditor";
import { normalizeYoutubeUrl } from "@/features/products/components/rich-text-urls";
import { validateProductFile } from "@/features/products/validation";
import { createClient } from "@/lib/supabase/client";
import { uploadShopAsset } from "@/lib/supabase/upload";
import type { CourseLesson } from "./model";
import { normalizeDocumentUrl, validateCourseLessons } from "./validation";
import { sanitizeLessonHtml } from "./sanitize";
import { ArrowDownIcon, ArrowUpIcon, DocumentIcon, ExternalIcon, LibraryIcon, PlusIcon } from "@/components/icons";

export function CurriculumEditor({ productId, productName, userId, initialLessons, published }: {
  productId: string; productName: string; userId: string; initialLessons: CourseLesson[]; published: boolean;
}) {
  const router = useRouter();
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedId, setSelectedId] = useState(initialLessons[0]?.id ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const uploadController = useRef<AbortController | null>(null);
  const lesson = lessons.find(item => item.id === selectedId);
  const locked = saving || uploading;

  useEffect(() => () => uploadController.current?.abort(), []);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) { if (dirty || uploading) event.preventDefault(); }
    function navigate(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest("a");
      if ((!dirty && !uploading) || !anchor || anchor.target === "_blank" || anchor.origin !== location.origin) return;
      if (!confirm("มีบทเรียนที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) event.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", navigate, true); };
  }, [dirty, uploading]);

  function change(next: CourseLesson[]) { setLessons(next); setDirty(true); setMessage(""); }
  function patch(patchValue: Partial<CourseLesson>, id = selectedId) {
    setLessons(current => current.map(item => item.id === id ? { ...item, ...patchValue } : item));
    setDirty(true); setMessage("");
  }
  function addLesson() {
    const id = crypto.randomUUID();
    change([...lessons, {id, title: `บทเรียนที่ ${lessons.length + 1}`, position: lessons.length, content_html:"", youtube_url:null, documents:[], published:true}]);
    setSelectedId(id);
  }
  function move(delta: number) {
    const index = lessons.findIndex(item => item.id === selectedId);
    if (index + delta < 0 || index + delta >= lessons.length) return;
    const next = [...lessons];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    change(next);
  }
  async function upload(file?: File) {
    if (!file || !lesson) return;
    const validationError = validateProductFile(file);
    if (validationError) { setErrors([validationError]); return; }
    const targetId = lesson.id;
    setUploading(true); setErrors([]); setProgress(0);
    const controller = new AbortController(); uploadController.current = controller;
    try {
      const result = await uploadShopAsset({userId, file, destination:"product-file", signal:controller.signal, onProgress:setProgress});
      setLessons(current => current.map(item => item.id === targetId ? {...item, documents:[...item.documents, {id:crypto.randomUUID(), name:file.name, path:result.path}]} : item));
      setDirty(true);
    } catch (error) { setErrors([error instanceof Error ? error.message : "อัปโหลดเอกสารไม่สำเร็จ"]); }
    finally { setUploading(false); uploadController.current = null; }
  }
  function addDocumentLink() {
    const url = normalizeDocumentUrl(documentUrl);
    if (!url || !documentName.trim()) { setErrors(["กรอกชื่อเอกสารและลิงก์ HTTPS ที่ถูกต้อง"]); return; }
    if (!lesson) return;
    patch({documents:[...lesson.documents, {id:crypto.randomUUID(), name:documentName.trim(), url}]});
    setDocumentName(""); setDocumentUrl(""); setErrors([]);
  }
  async function save(publishCourse = false) {
    const validationErrors = validateCourseLessons(lessons, userId);
    if (publishCourse && !lessons.some(item => item.published)) validationErrors.push("เพิ่มบทเรียนที่เผยแพร่อย่างน้อย 1 บทก่อนเปิดขาย");
    if (validationErrors.length) { setErrors(validationErrors); return; }
    setSaving(true); setErrors([]); setMessage("");
    const normalized = lessons.map((item, position) => ({...item, position, title:item.title.trim(), content_html:sanitizeLessonHtml(item.content_html), youtube_url:item.youtube_url ? normalizeYoutubeUrl(item.youtube_url) : null}));
    try {
      const supabase = createClient();
      const {error} = await supabase.rpc("save_course_lessons", {p_product_id:productId, p_lessons:normalized});
      if (error) throw error;
      setLessons(normalized); setDirty(false);
      if (publishCourse) {
        const {error: publishError} = await supabase.from("products").update({published:true}).eq("id",productId);
        if (publishError) throw publishError;
        if (!(await invalidatePublicCatalog())) setErrors([CATALOG_REFRESH_WARNING]);
      }
      setMessage(publishCourse ? "บันทึกบทเรียนและเผยแพร่คอร์สแล้ว" : "บันทึกบทเรียนแล้ว"); router.refresh();
    } catch (error) { setErrors([typeof error === "object" && error && "message" in error ? String(error.message) : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"]); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-6xl">
    <Link href={`/dashboard/products/${productId}/edit`} className="text-sm text-muted hover:text-ink">‹ ข้อมูลสินค้า</Link>
    <div className="my-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold text-ink">{productName}</h1><p className="mt-2 text-sm text-muted">จัดบทเรียนให้เรียนง่าย อ่านสบาย พร้อมเอกสารประกอบ</p></div><Link href={`/learn/${productId}`} target="_blank" className="secondary-button inline-flex items-center gap-1.5">ดูตัวอย่างคอร์ส<ExternalIcon className="size-3.5" /></Link></div>
    <div className="overflow-hidden rounded-2xl border border-line bg-paper lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-line bg-paper-dim/50 p-4 lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">สารบัญบทเรียน</h2><span className="text-xs text-muted">{lessons.length} บท</span></div>
        <nav aria-label="เลือกบทเรียน" className="max-h-72 space-y-1 overflow-auto lg:max-h-none">{lessons.map((item,index) => <button key={item.id} type="button" disabled={locked} onClick={() => {setSelectedId(item.id); setDocumentName(""); setDocumentUrl("");}} aria-current={item.id === selectedId ? "page" : undefined} className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left text-sm ${item.id === selectedId ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-paper"}`}><span className="text-xs opacity-60">{String(index+1).padStart(2,"0")}</span><span className="min-w-0 break-words">{item.title || "ยังไม่มีชื่อ"}{!item.published && <span className="mt-1 block text-[10px] text-muted">แบบร่าง</span>}</span></button>)}</nav>
        <button type="button" onClick={addLesson} disabled={locked || lessons.length >= 100} className="secondary-button mt-4 inline-flex w-full items-center justify-center gap-2"><PlusIcon className="size-4" />เพิ่มบทเรียน</button>
      </aside>
      <main className="min-w-0 p-5 sm:p-8">
        {lesson ? <fieldset disabled={locked} className="space-y-6 disabled:opacity-60">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">แก้ไขบทเรียน</span><div className="flex gap-2"><button type="button" className="small-button" disabled={locked || lessons[0]?.id === selectedId} onClick={() => move(-1)} aria-label="เลื่อนบทเรียนขึ้น"><ArrowUpIcon className="size-3.5" /></button><button type="button" className="small-button" disabled={locked || lessons.at(-1)?.id === selectedId} onClick={() => move(1)} aria-label="เลื่อนบทเรียนลง"><ArrowDownIcon className="size-3.5" /></button><button type="button" className="small-button text-red-600" onClick={() => {if(confirm("ลบบทเรียนนี้? การเปลี่ยนแปลงมีผลเมื่อบันทึก")){ const next = lessons.filter(item => item.id !== selectedId); change(next);setSelectedId(next[0]?.id ?? "");}}}>ลบบทเรียน</button></div></div>
          <label className="field-label">ชื่อบทเรียน<input className="field-input mt-2" maxLength={200} value={lesson.title} onChange={e => patch({title:e.target.value})}/></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lesson.published} onChange={e => patch({published:e.target.checked})}/>แสดงบทเรียนนี้ให้ผู้เรียน</label>
          <label className="field-label">วิดีโอ YouTube <span className="font-normal text-muted">(ถ้ามี)</span><input type="url" className="field-input mt-2" placeholder="https://youtube.com/watch?v=..." value={lesson.youtube_url ?? ""} onChange={e => patch({youtube_url:e.target.value || null})}/><span className="mt-2 block text-xs font-normal text-muted">รองรับวิดีโอ YouTube ที่อนุญาตให้ฝัง วิดีโอยังคงอยู่บน YouTube</span></label>
          <div><p className="field-label mb-2">เนื้อหาบทเรียน</p><RichTextEditor disabled={locked} key={lesson.id} label="เนื้อหาบทเรียน" value={lesson.content_html} maxCharacters={50000} allowVideo={false} onChange={content_html => patch({content_html})}/></div>
          <section className="border-t border-line pt-6"><h3 className="font-semibold text-ink">เอกสารประกอบ</h3><p className="mt-1 text-xs leading-5 text-muted">ไฟล์อัปโหลดเปิดได้เฉพาะผู้มีสิทธิ์เรียน ลิงก์ภายนอกขึ้นอยู่กับการตั้งค่าสิทธิ์ของเว็บไซต์ปลายทาง</p>
            <ul className="mt-4 divide-y divide-line">{lesson.documents.map(doc => <li key={doc.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="flex min-w-0 items-center gap-2 break-words"><DocumentIcon className="size-3.5 shrink-0 text-muted" />{doc.name}<span className="ml-2 text-xs text-muted">{doc.path ? "ไฟล์ส่วนตัว" : "ลิงก์ภายนอก"}</span></span><button type="button" aria-label={`ลบเอกสาร ${doc.name}`} className="text-xs text-red-600" onClick={() => patch({documents:lesson.documents.filter(item => item.id !== doc.id)})}>ลบ</button></li>)}</ul>
            <label className="mt-4 block text-xs font-semibold">อัปโหลดไฟล์ (ไม่เกิน 50 MB)<input type="file" className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-paper-dim file:px-4 file:py-2" disabled={locked || lesson.documents.length >= 20} onChange={e => {void upload(e.target.files?.[0]); e.target.value="";}}/></label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="field-label">ชื่อเอกสาร<input className="field-input mt-2" value={documentName} maxLength={200} onChange={e => setDocumentName(e.target.value)}/></label><label className="field-label">ลิงก์เอกสาร HTTPS<input type="url" className="field-input mt-2" value={documentUrl} placeholder="https://..." onChange={e => setDocumentUrl(e.target.value)}/></label></div><button type="button" disabled={locked || lesson.documents.length >= 20} className="secondary-button mt-3" onClick={addDocumentLink}>เพิ่มลิงก์เอกสาร</button>
          </section>
        </fieldset> : <div className="flex min-h-80 flex-col items-center justify-center text-center"><LibraryIcon className="size-10 text-muted" /><h2 className="mt-4 text-xl font-semibold">เริ่มต้นบทเรียนแรก</h2><p className="mt-2 text-sm text-muted">แบ่งความรู้เป็นบทสั้น ๆ แล้วเพิ่มวิดีโอหรือเอกสาร</p><button type="button" onClick={addLesson} className="primary-button mt-6 inline-flex items-center gap-2"><PlusIcon className="size-4" />เพิ่มบทเรียน</button></div>}
      </main>
    </div>
    {uploading && <p role="status" className="mt-4 text-sm">กำลังอัปโหลด {progress}% <button type="button" className="ml-3 underline" onClick={() => uploadController.current?.abort()}>ยกเลิก</button></p>}
    {errors.length > 0 && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{errors.map((error,index) => <p key={index}>{error}</p>)}</div>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
    <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper/95 p-4 backdrop-blur"><span className="mr-auto text-xs text-muted">{dirty ? "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" : "บันทึกล่าสุดแล้ว"}</span><button type="button" disabled={locked} onClick={() => void save()} className="secondary-button">{saving ? "กำลังบันทึก..." : "บันทึกบทเรียน"}</button>{!published && <button type="button" disabled={locked} onClick={() => void save(true)} className="primary-button">บันทึกและเผยแพร่คอร์ส</button>}</div>
  </div>;
}
