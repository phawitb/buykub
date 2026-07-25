type SalesDay = {
  key: string;
  label: string;
  total: number;
};

export function SalesChart({ days }: { days: SalesDay[] }) {
  const maxDay = Math.max(1, ...days.map((day) => day.total));

  return (
    <div className="mt-5 flex items-end justify-between gap-2">
      {days.map((day) => (
        <div
          key={day.key}
          className="flex min-w-0 flex-1 flex-col items-center gap-2"
        >
          <span className="max-w-full truncate text-[10px] font-medium text-ink-soft">
            ฿{(day.total / 100).toLocaleString("th-TH")}
          </span>
          <div className="flex h-24 w-full items-end">
            <div
              className="w-full rounded-t bg-accent"
              style={{ height: `${Math.max(4, (day.total / maxDay) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted">{day.label}</span>
        </div>
      ))}
    </div>
  );
}
