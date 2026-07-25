export default function ShopLoading() {
  return (
    <main className="min-h-screen bg-[#faf9f7] py-0 sm:py-10">
      <div className="mx-auto max-w-2xl overflow-hidden bg-paper sm:rounded-[28px]">
        <div className="aspect-[16/5] animate-pulse bg-paper-dim" />
        <div className="px-5 pb-14 sm:px-6">
          <div className="-mt-9 h-[76px] w-[76px] animate-pulse rounded-full border-4 border-paper bg-line" />
          <div className="mt-4 h-7 w-40 animate-pulse rounded bg-line" />
          <div className="mt-3 h-4 w-60 animate-pulse rounded bg-paper-dim" />
          <div className="mt-8 grid grid-cols-1 gap-4 border-t border-line pt-12 min-[460px]:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item}>
                <div className="aspect-square animate-pulse rounded-2xl bg-paper-dim" />
                <div className="mt-3 h-4 animate-pulse rounded bg-line" />
                <div className="mt-2 h-4 w-20 animate-pulse rounded bg-paper-dim" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
