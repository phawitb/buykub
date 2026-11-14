export function ProductDetailShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background py-0">
      <article className="relative mx-auto max-w-[640px] overflow-hidden bg-paper">
        {children}
      </article>
    </main>
  );
}
