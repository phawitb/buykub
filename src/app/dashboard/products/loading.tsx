export default function ProductsLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="กำลังโหลดสินค้า"
      className="max-w-3xl animate-pulse"
    >
      <span className="sr-only">กำลังโหลดสินค้า</span>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-7 w-24 rounded bg-paper-dim" />
          <div className="mt-2 h-4 w-60 max-w-[65vw] rounded bg-paper-dim" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-paper-dim sm:rounded-full" />
      </div>

      <div className="mt-8 space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            data-testid="product-row-skeleton"
            className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4"
          >
            <div className="h-20 w-20 shrink-0 rounded-xl bg-paper-dim" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-20 rounded bg-paper-dim" />
              <div className="mt-3 h-5 w-2/5 rounded bg-paper-dim" />
              <div className="mt-3 h-4 w-28 rounded bg-paper-dim" />
            </div>
            <div className="hidden h-9 w-40 rounded-full bg-paper-dim sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
