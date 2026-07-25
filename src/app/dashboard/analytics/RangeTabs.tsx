"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function RangeTabs({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const options = [
    { key: "7", label: "7 วัน" },
    { key: "30", label: "30 วัน" },
    { key: "90", label: "90 วัน" },
  ];

  function setRange(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    router.push(`/dashboard/analytics?${params.toString()}`);
  }

  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setRange(o.key)}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium ${
            current === o.key
              ? "border-ink bg-ink text-paper"
              : "border-line text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
