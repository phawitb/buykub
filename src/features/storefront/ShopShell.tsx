export function ShopShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#faf9f7] py-0">
      <div
        data-testid="shop-canvas"
        className="mx-auto min-h-screen max-w-[640px] overflow-hidden bg-paper"
      >
        {children}
      </div>
    </main>
  );
}
