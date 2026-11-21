import type { ReactNode } from "react";

export const shopIconButton = "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-lift-1 transition hover:bg-paper-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50";

export function ShopIcon({ name }: { name: "edit" | "image" | "plus" | "close" | "book" | "eye" | "eye-off" | "trash" | "external" | "grip" }) {
  const paths: Record<typeof name, ReactNode> = {
    edit: <><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m14 5 5 5" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" /><path d="m3 16 5-5 4 4 4-4 5 5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    book: <><path d="M12 5v16M12 5C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 1Z" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    "eye-off": <><path d="m3 3 18 18M10 5a12 12 0 0 1 12 7s-1 2-3 4M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 3-.5 4-1" /><path d="M10 10a3 3 0 0 0 4 4" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
    external: <><path d="M14 3h7v7M21 3 10 14M10 3H4v17h17v-6" /></>,
    grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  };
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
