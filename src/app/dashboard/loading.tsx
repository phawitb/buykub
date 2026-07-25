export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="กำลังโหลดข้อมูลหลังร้าน"
      className="max-w-4xl animate-pulse"
    >
      <span className="sr-only">กำลังโหลดข้อมูลหลังร้าน</span>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-7 w-56 max-w-[70vw] rounded bg-paper-dim" />
          <div className="mt-2 h-4 w-44 rounded bg-paper-dim" />
          <div className="mt-4 h-8 w-52 max-w-full rounded-full bg-paper-dim" />
        </div>
        <div className="h-10 w-28 shrink-0 rounded-full bg-paper-dim" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div
          data-testid="dashboard-card-skeleton"
          className="col-span-2 h-40 rounded-2xl border border-line bg-paper-dim"
        />
        <div
          data-testid="dashboard-card-skeleton"
          className="h-40 rounded-2xl border border-line bg-paper-dim"
        />
        <div
          data-testid="dashboard-card-skeleton"
          className="h-40 rounded-2xl border border-line bg-paper-dim"
        />
      </div>

      <div
        data-testid="dashboard-card-skeleton"
        className="mt-6 h-48 rounded-2xl border border-line bg-paper-dim"
      />
      <div className="mt-6 h-64 rounded-2xl border border-line bg-paper-dim" />
    </div>
  );
}
