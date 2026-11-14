"use client";
import { useState } from "react";

export function CourseVideo({ title, url }: { title: string; url: string }) {
  const [opened, setOpened] = useState(false);
  return <div className="mb-10 overflow-hidden rounded-xl bg-ink">
    {opened ? <iframe title={`วิดีโอ ${title}`} src={url} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"/> :
      <button type="button" aria-label={`เปิดวิดีโอบทเรียน ${title}`} onClick={() => setOpened(true)} className="flex aspect-video w-full flex-col items-center justify-center gap-4 px-6 text-paper transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-paper/15 text-2xl">▶</span>
        <span className="text-sm font-semibold">เปิดวิดีโอบทเรียน</span>
        <span className="text-xs text-paper/60">YouTube · {title}</span>
      </button>}
  </div>;
}
