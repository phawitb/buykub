"use client";

import { useMemo } from "react";
import type {
  ProductKeyInventorySummary,
  ProductKeyRecord,
} from "@/features/products/model";
import { parseProductKeys } from "@/features/products/product-keys";

export function ProductKeyInventory({
  value,
  onChange,
  summary,
  records = [],
  error,
  onStatusChange,
}: {
  value: string;
  onChange: (value: string) => void;
  summary: ProductKeyInventorySummary;
  records?: ProductKeyRecord[];
  error?: string;
  onStatusChange?: (
    id: string,
    status: "available" | "disabled",
  ) => Promise<void>;
}) {
  const parsed = useMemo(() => parseProductKeys(value), [value]);

  return (
    <section className="product-section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="product-section-title">คลัง Product Key</h2>
          <p className="product-help">
            วาง Key หนึ่งรายการต่อหนึ่งบรรทัด ระบบจะตัดรายการซ้ำให้อัตโนมัติ
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            พร้อมขาย {summary.available}
          </span>
          <span className="rounded-full bg-paper-dim px-3 py-1.5 text-ink">
            ขายแล้ว {summary.assigned}
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
            ปิดใช้งาน {summary.disabled}
          </span>
        </div>
      </div>

      <label className="field-label mt-5 block">
        รายการ Product Key
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={8}
          spellCheck={false}
          autoComplete="off"
          className="field-input mt-2 min-h-44 resize-y font-mono text-sm"
          placeholder={"AAAA-BBBB-CCCC\nDDDD-EEEE-FFFF"}
          aria-invalid={Boolean(error)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>พร้อมนำเข้า {parsed.keys.length} รายการ</span>
        {parsed.duplicateCount > 0 && (
          <span className="text-amber-700">
            ซ้ำในรายการ {parsed.duplicateCount}
          </span>
        )}
        {parsed.blankCount > 0 && <span>ข้ามบรรทัดว่าง {parsed.blankCount}</span>}
      </div>
      {error && <p className="field-error mt-2">{error}</p>}

      {records.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line">
          <div className="grid grid-cols-[1fr_auto] gap-4 bg-paper-dim px-4 py-3 text-xs font-semibold text-muted">
            <span>Key เดิม</span>
            <span>สถานะ</span>
          </div>
          <ul className="divide-y divide-line">
            {records.map((record) => (
              <li
                key={record.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3"
              >
                <code className="truncate text-xs text-ink">
                  {record.status === "assigned"
                    ? record.keyValue
                    : `${record.keyValue.slice(0, 4)}••••${record.keyValue.slice(-4)}`}
                </code>
                {record.status === "assigned" || !onStatusChange ? (
                  <span className="text-xs font-semibold text-muted">
                    {record.status === "available"
                      ? "พร้อมขาย"
                      : record.status === "assigned"
                        ? "ขายแล้ว"
                        : "ปิดใช้งาน"}
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`${
                      record.status === "available" ? "ปิดใช้" : "เปิดใช้"
                    } Key ${record.keyValue.slice(0, 4)}`}
                    onClick={() =>
                      void onStatusChange(
                        record.id,
                        record.status === "available"
                          ? "disabled"
                          : "available",
                      )
                    }
                    className="text-xs font-semibold text-accent"
                  >
                    {record.status === "available" ? "ปิดใช้" : "เปิดใช้"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
