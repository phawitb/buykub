export function ShopShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background py-0">
      <div
        data-testid="shop-canvas"
        className="min-h-screen w-full overflow-hidden bg-paper"
      >
        {children}
      </div>
    </main>
  );
}
