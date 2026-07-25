import Link from "next/link";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#faf9f7] px-5 py-10 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-bold tracking-tight text-ink">
          FRAME<span className="text-muted">LINK</span>
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-xs text-muted">อัปเดตล่าสุด {updatedAt}</p>
        <div className="legal-prose mt-8 space-y-7 text-sm leading-7 text-ink-soft">
          {children}
        </div>
      </article>
    </main>
  );
}
