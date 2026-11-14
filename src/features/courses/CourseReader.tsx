"use client";
import Link from "next/link";
import { CourseVideo } from "./CourseVideo";
import { useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, DocumentIcon, ExternalIcon } from "@/components/icons";

type ReaderLesson = {id:string; title:string; content_html:string; youtube_url:string|null; documents:{id:string;name:string}[]};
export function CourseReader({productId, name, lessons, expiresAt, owner}:{productId:string;name:string;lessons:ReaderLesson[];expiresAt:string|null;owner:boolean}) {
  const [selectedId,setSelectedId] = useState(lessons[0]?.id ?? "");
  const index = lessons.findIndex(item => item.id === selectedId);
  const lesson = lessons[index];
  function select(id:string) { setSelectedId(id); window.scrollTo({top:0,behavior:"smooth"}); }
  return <div className="min-h-screen bg-paper text-ink">
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-paper/95 px-5 backdrop-blur lg:px-8"><Link href="/learn" className="shrink-0 text-sm font-semibold">‹ รายการที่สั่งซื้อ</Link><span className="truncate text-sm text-muted">{name}</span>{owner && <Link href={`/dashboard/products/${productId}/lessons`} className="shrink-0 text-xs underline">แก้ไขคอร์ส</Link>}</header>
    <div className="mx-auto max-w-[1500px] lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-line bg-paper-dim/40 p-5 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:overflow-auto lg:border-b-0 lg:border-r lg:p-7">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-muted">YOUR CLASSROOM</p><h1 className="mt-3 text-lg font-bold leading-7">{name}</h1>
        <p className="mt-3 text-xs leading-5 text-muted">{lessons.length} บทเรียน · {owner ? "ตัวอย่างสำหรับผู้สอน" : expiresAt ? `เข้าเรียนได้ถึง ${new Date(expiresAt).toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok"})}` : "สิทธิ์ตลอดชีพ"}</p>
        <label className="mt-5 block text-xs lg:hidden">เลือกบทเรียน<select className="field-input mt-2" value={selectedId} onChange={event => select(event.target.value)}>{lessons.map((item,i) => <option value={item.id} key={item.id}>{i+1}. {item.title}</option>)}</select></label>
        <nav aria-label="สารบัญบทเรียน" className="mt-8 hidden space-y-1 lg:block">{lessons.map((item,i) => <button key={item.id} type="button" onClick={() => select(item.id)} aria-current={item.id === selectedId ? "page" : undefined} className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${item.id === selectedId ? "bg-accent-soft font-semibold text-accent" : "text-ink-soft hover:bg-paper-dim"}`}><span className="mt-0.5 text-[10px] opacity-60">{String(i+1).padStart(2,"0")}</span><span className="break-words">{item.title}</span></button>)}</nav>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-10 lg:px-14 lg:py-16"><article className="mx-auto max-w-3xl">
        {lesson ? <><p className="text-xs font-semibold tracking-widest text-muted">บทเรียน {index+1} / {lessons.length}</p><h2 className="mb-8 mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{lesson.title}</h2>
          {lesson.youtube_url && <CourseVideo key={lesson.id} title={lesson.title} url={lesson.youtube_url}/>}
          <div className="product-prose min-h-24" dangerouslySetInnerHTML={{__html:lesson.content_html}}/>
          {lesson.documents.length > 0 && <section className="mt-12 rounded-xl border border-line bg-paper-dim/40 p-5"><h3 className="text-sm font-semibold">เอกสารประกอบบทเรียน</h3><ul className="mt-4 space-y-2">{lesson.documents.map(doc => <li key={doc.id}><a href={`/api/courses/${productId}/documents/${encodeURIComponent(doc.id)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm transition hover:border-accent"><span className="flex min-w-0 items-center gap-2.5"><DocumentIcon className="size-4 shrink-0 text-muted" /><span className="break-words">{doc.name}</span></span><ExternalIcon className="size-3.5 shrink-0 text-muted" /></a></li>)}</ul></section>}
          <div className="mt-14 flex justify-between gap-4 border-t border-line pt-6"><button type="button" disabled={index <= 0} className="secondary-button disabled:opacity-30" onClick={() => select(lessons[index-1].id)}><ArrowLeftIcon className="mr-1.5 inline size-4 align-[-0.2em]" />บทก่อนหน้า</button>{index < lessons.length-1 ? <button type="button" className="primary-button" onClick={() => select(lessons[index+1].id)}>บทถัดไป<ArrowRightIcon className="ml-1.5 inline size-4 align-[-0.2em]" /></button> : <Link href="/learn" className="primary-button">กลับไปรายการที่สั่งซื้อ</Link>}</div>
        </> : <div className="py-20 text-center"><h2 className="text-xl font-semibold">ผู้สอนกำลังเตรียมบทเรียน</h2><p className="mt-3 text-sm text-muted">กลับมาเปิดคอร์สนี้อีกครั้งได้จากรายการที่สั่งซื้อ</p></div>}
      </article></main>
    </div>
  </div>;
}
