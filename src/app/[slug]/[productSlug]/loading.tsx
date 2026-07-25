export default function ProductDetailLoading() {
  return (
    <main className="min-h-screen bg-[#faf9f7] py-0 sm:py-10">
      <div className="mx-auto max-w-2xl overflow-hidden bg-paper sm:rounded-[28px]">
        <div className="aspect-square animate-pulse bg-paper-dim" />
        <div className="px-5 py-7 sm:px-6">
          <div className="h-6 w-20 animate-pulse rounded-full bg-line" />
          <div className="mt-4 h-8 w-4/5 animate-pulse rounded bg-line" />
          <div className="mt-3 h-7 w-28 animate-pulse rounded bg-paper-dim" />
          <div className="mt-6 h-14 animate-pulse rounded-2xl bg-line" />
        </div>
      </div>
    </main>
  );
}
