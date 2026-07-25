type FunnelStep = {
  label: string;
  value: number;
};

export function ConversionFunnel({ steps }: { steps: FunnelStep[] }) {
  const views = steps[0]?.value ?? 0;

  return (
    <div className="mt-5">
      {steps.map((step, index) => {
        const next = steps[index + 1];
        const shareOfViews = views > 0 ? (step.value / views) * 100 : 0;
        const stepConversion =
          next && step.value > 0 ? (next.value / step.value) * 100 : 0;

        return (
          <div key={step.label}>
            <div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="w-6 text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-medium text-ink">{step.label}</span>
                <span className="font-bold text-ink">{step.value}</span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-paper-dim">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${shareOfViews}%` }}
                />
              </div>
            </div>

            {next && (
              <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted">
                <span aria-hidden="true">↓</span>
                <span>{stepConversion.toFixed(1)}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
