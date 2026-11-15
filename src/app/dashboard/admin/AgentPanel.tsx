"use client";

import { useState } from "react";
import type { AgentSellerUsage, AgentUsageDashboard } from "@/lib/agent/admin";
import { AGENT_MODELS, formatUsd, isAgentModelId } from "@/lib/agent/pricing";
import {
  Badge,
  buttonClass,
  cardClass,
  ConfirmDialog,
  dateLabel,
  EmptyState,
  Feedback,
  inputClass,
  primaryClass,
  useAdminAction,
} from "./AdminControls";

type LimitMode = "default" | "custom" | "unlimited" | "blocked";

export function limitLabel(micros: number): string {
  if (micros < 0) return "ไม่จำกัด";
  if (micros === 0) return "ปิดใช้งาน";
  return `${formatUsd(micros)} / เดือน`;
}

export function microsToUsdInput(micros: number): string {
  if (micros <= 0) return "";
  return String(Math.round((micros / 1_000_000) * 1_000_000) / 1_000_000);
}

export function usdInputToMicros(value: string): number | null {
  const trimmed = value.trim();
  // An empty box is not zero: zero blocks the seller, so it must be typed.
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000) return null;
  return Math.round(parsed * 1_000_000);
}

function modeFor(seller: AgentSellerUsage): LimitMode {
  if (!seller.limitOverridden) return "default";
  if (seller.limitMicros < 0) return "unlimited";
  if (seller.limitMicros === 0) return "blocked";
  return "custom";
}

function sellerName(seller: { fullName: string | null; email: string | null; userId: string }) {
  return seller.fullName || seller.email || seller.userId;
}

function usageBar(usedMicros: number, limitMicros: number) {
  if (limitMicros <= 0) return null;
  const percent = Math.min(100, Math.round((usedMicros / limitMicros) * 100));
  return (
    <span className="mt-2 block">
      <span
        className="block h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="สัดส่วนโควตาที่ใช้ไป"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span
          className={`block h-full rounded-full ${percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-accent"}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="mt-1 block text-xs text-muted">{percent}% ของโควตาเดือนนี้</span>
    </span>
  );
}

/**
 * Both draft paths run on the same model, so the operation name is the only
 * thing that says whether scanned files are what is spending the quota.
 */
export function operationLabel(operation: string): string {
  if (operation === "product-draft") return "ร่างสินค้าจากข้อความใน PDF";
  if (operation === "product-draft-ocr") return "ร่างสินค้าจาก PDF สแกน (OCR)";
  return operation;
}

export function AgentPanel({ data }: { data: AgentUsageDashboard }) {
  const action = useAdminAction();
  const [defaultUsd, setDefaultUsd] = useState(() => microsToUsdInput(data.defaultLimitMicros) || "0");
  const [confirmDefault, setConfirmDefault] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState<LimitMode>("default");
  const [customUsd, setCustomUsd] = useState("");
  const [confirmSeller, setConfirmSeller] = useState(false);

  const selected = data.sellers.find((seller) => seller.userId === editing);
  const defaultMicros = usdInputToMicros(defaultUsd);
  const pendingMicros =
    mode === "default" ? null : mode === "unlimited" ? -1 : mode === "blocked" ? 0 : usdInputToMicros(customUsd);
  const pendingValid = mode === "default" || mode === "unlimited" || mode === "blocked" || pendingMicros !== null;

  function openEditor(seller: AgentSellerUsage) {
    setEditing(seller.userId);
    const next = modeFor(seller);
    setMode(next);
    setCustomUsd(next === "custom" ? microsToUsdInput(seller.limitMicros) : microsToUsdInput(data.defaultLimitMicros));
  }

  const metrics = [
    { label: "ค่าใช้จ่ายเดือนนี้", value: formatUsd(data.month.micros) },
    { label: "ค่าใช้จ่ายทั้งหมด", value: formatUsd(data.total.micros) },
    { label: "จำนวนครั้งเดือนนี้", value: data.month.calls.toLocaleString("th-TH") },
    {
      label: "โทเคนเดือนนี้",
      value: (data.month.promptTokens + data.month.completionTokens).toLocaleString("th-TH"),
    },
  ];

  return (
    <div className="space-y-5">
      <Feedback error={confirmDefault || confirmSeller ? "" : action.error} notice={action.notice} />

      <div>
        <h2 className="text-lg font-semibold text-ink">ค่าใช้จ่าย AI ช่วยกรอกข้อมูลสินค้า</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          คิดจากจำนวนโทเคนที่ DeepSeek รายงานกลับมาในแต่ละครั้ง ตามราคาประกาศของผู้ให้บริการ · เดือนตามเวลาไทย
          เริ่มนับ {dateLabel(data.monthStart)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className={cardClass}>
            <p className="text-xs text-muted">{metric.label}</p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-ink">{metric.value}</p>
          </div>
        ))}
      </div>

      <form
        className={`${cardClass} space-y-4`}
        onSubmit={(event) => {
          event.preventDefault();
          if (defaultMicros !== null) setConfirmDefault(true);
        }}
      >
        <div>
          <h3 className="text-sm font-semibold text-ink">โควตาเริ่มต้นต่อผู้ขายหนึ่งคน</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            ใช้กับผู้ขายทุกคนที่ยังไม่ได้ตั้งค่าเฉพาะราย เมื่อใช้ครบ ผู้ขายจะยังสร้างสินค้าได้
            แต่ต้องกรอกข้อมูลเอง
          </p>
        </div>
        <label className="block max-w-xs text-sm font-medium text-ink">
          โควตาต่อเดือน (USD)
          <input
            className={`${inputClass} mt-2`}
            type="number"
            min="0"
            max="1000"
            step="0.01"
            value={defaultUsd}
            onChange={(event) => setDefaultUsd(event.target.value)}
          />
          <span className="mt-1.5 block text-xs font-normal text-muted">
            ปัจจุบัน {limitLabel(data.defaultLimitMicros)} · 0 คือปิดการใช้งานสำหรับทุกคน
          </span>
        </label>
        <button className={primaryClass} disabled={action.busy || defaultMicros === null}>
          บันทึกโควตาเริ่มต้น
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-ink">การใช้งานรายผู้ขาย</h3>
        {!data.sellers.length ? (
          <div className="mt-3">
            <EmptyState>ยังไม่มีผู้ขายคนไหนใช้ AI ช่วยกรอกข้อมูล</EmptyState>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-paper-dim text-xs text-muted">
                <tr>
                  {["ผู้ขาย", "เดือนนี้", "ทั้งหมด", "โควตา", "ใช้ครั้งล่าสุด", "จัดการ"].map((label) => (
                    <th key={label} className="px-5 py-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.sellers.map((seller) => {
                  const exhausted =
                    seller.limitMicros >= 0 && seller.monthMicros >= seller.limitMicros;
                  return (
                    <tr key={seller.userId} className="bg-paper">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink">{seller.fullName || "ยังไม่ได้ระบุชื่อ"}</p>
                        <p className="mt-1 break-all text-xs text-muted">{seller.email || seller.userId}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="tabular-nums text-ink">{formatUsd(seller.monthMicros)}</p>
                        <p className="mt-1 text-xs text-muted">{seller.monthCalls.toLocaleString("th-TH")} ครั้ง</p>
                        {usageBar(seller.monthMicros, seller.limitMicros)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="tabular-nums text-ink">{formatUsd(seller.totalMicros)}</p>
                        <p className="mt-1 text-xs text-muted">{seller.totalCalls.toLocaleString("th-TH")} ครั้ง</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <Badge tone={exhausted ? "warning" : "neutral"}>{limitLabel(seller.limitMicros)}</Badge>
                        <p className="mt-2 text-xs text-muted">
                          {seller.limitOverridden ? "ตั้งค่าเฉพาะราย" : "ใช้ค่าเริ่มต้น"}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top text-xs text-muted">{dateLabel(seller.lastUsedAt)}</td>
                      <td className="px-5 py-4 align-top">
                        <button className={buttonClass} onClick={() => openEditor(seller)}>
                          ตั้งโควตา
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <form
          className={cardClass}
          onSubmit={(event) => {
            event.preventDefault();
            if (pendingValid) setConfirmSeller(true);
          }}
        >
          <div className="flex justify-between gap-4">
            <div>
              <h3 className="font-semibold text-ink">{sellerName(selected)}</h3>
              <p className="mt-1 text-xs text-muted">
                ใช้ไปเดือนนี้ {formatUsd(selected.monthMicros)} · {selected.monthCalls} ครั้ง
              </p>
            </div>
            <button type="button" className="text-sm text-muted" onClick={() => setEditing(null)}>
              ปิด
            </button>
          </div>
          <fieldset className="mt-5 space-y-2">
            <legend className="text-sm font-medium text-ink">โควตาของผู้ขายคนนี้</legend>
            {(
              [
                ["default", `ใช้ค่าเริ่มต้นของระบบ (${limitLabel(data.defaultLimitMicros)})`],
                ["custom", "กำหนดเองเป็น USD ต่อเดือน"],
                ["unlimited", "ไม่จำกัด"],
                ["blocked", "ปิดการใช้งาน AI สำหรับผู้ขายคนนี้"],
              ] as const
            ).map(([item, label]) => (
              <label key={item} className="flex items-center gap-3 text-sm text-ink">
                <input
                  type="radio"
                  name="agent-limit-mode"
                  className="size-4 accent-accent"
                  checked={mode === item}
                  onChange={() => setMode(item)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {mode === "custom" && (
            <label className="mt-4 block max-w-xs text-sm font-medium text-ink">
              โควตาต่อเดือน (USD)
              <input
                className={`${inputClass} mt-2`}
                type="number"
                min="0"
                max="1000"
                step="0.01"
                value={customUsd}
                onChange={(event) => setCustomUsd(event.target.value)}
              />
            </label>
          )}
          <button className={`${primaryClass} mt-5`} disabled={action.busy || !pendingValid}>
            ตรวจสอบก่อนบันทึก
          </button>
        </form>
      )}

      {data.byModel.length > 0 && (
        <div className={cardClass}>
          <h3 className="text-sm font-semibold text-ink">แยกตามโมเดล</h3>
          <ul className="mt-4 divide-y divide-line">
            {data.byModel.map((entry) => (
              <li key={entry.model} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm text-ink">
                  {isAgentModelId(entry.model) ? AGENT_MODELS[entry.model].label : entry.model}
                  <span className="ml-2 text-xs text-muted">{entry.model}</span>
                </span>
                <span className="text-sm tabular-nums text-ink-soft">
                  {formatUsd(entry.micros)} · {entry.calls.toLocaleString("th-TH")} ครั้ง
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.byOperation.length > 0 && (
        <div className={cardClass}>
          <h3 className="text-sm font-semibold text-ink">แยกตามงานที่ใช้</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            ไฟล์สแกนต้องอ่านตัวอักษรจากรูปก่อน (OCR) ซึ่งทำในเบราว์เซอร์ของผู้ขาย ไม่คิดค่า API
            เพิ่ม แต่ข้อความที่ได้อาจยาวหรือสั้นกว่าปกติ บรรทัดนี้บอกว่างานไหนใช้โควตาไปเท่าไหร่
          </p>
          <ul className="mt-4 divide-y divide-line">
            {data.byOperation.map((entry) => (
              <li
                key={entry.operation}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="text-sm text-ink">
                  {operationLabel(entry.operation)}
                  <span className="ml-2 text-xs text-muted">{entry.operation}</span>
                </span>
                <span className="text-sm tabular-nums text-ink-soft">
                  เดือนนี้ {formatUsd(entry.monthMicros)} ·{" "}
                  {entry.monthCalls.toLocaleString("th-TH")} ครั้ง
                  <span className="ml-2 text-xs text-muted">
                    (รวม {formatUsd(entry.micros)} · {entry.calls.toLocaleString("th-TH")} ครั้ง)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmDefault && defaultMicros !== null && (
        <ConfirmDialog
          title="เปลี่ยนโควตาเริ่มต้นของทุกคน?"
          busy={action.busy}
          onCancel={() => setConfirmDefault(false)}
          onConfirm={() =>
            action.run(
              "agent-default-limit",
              { limitMicros: defaultMicros },
              "บันทึกโควตาเริ่มต้นแล้ว",
              () => setConfirmDefault(false),
            )
          }
        >
          <p>
            โควตาใหม่: <strong>{limitLabel(defaultMicros)}</strong>
          </p>
          <p>มีผลกับผู้ขายทุกคนที่ไม่ได้ตั้งค่าเฉพาะราย และมีผลกับยอดใช้งานของเดือนปัจจุบันทันที</p>
          <Feedback error={action.error} notice="" />
        </ConfirmDialog>
      )}

      {confirmSeller && selected && (
        <ConfirmDialog
          title="เปลี่ยนโควตาของผู้ขายคนนี้?"
          busy={action.busy}
          onCancel={() => setConfirmSeller(false)}
          onConfirm={() =>
            action.run(
              "agent-limit",
              { userId: selected.userId, limitMicros: pendingMicros },
              "บันทึกโควตาของผู้ขายแล้ว",
              () => {
                setConfirmSeller(false);
                setEditing(null);
              },
            )
          }
        >
          <p>
            ผู้ขาย: <strong>{sellerName(selected)}</strong>
          </p>
          <p>
            โควตาใหม่:{" "}
            <strong>
              {mode === "default"
                ? `ใช้ค่าเริ่มต้น (${limitLabel(data.defaultLimitMicros)})`
                : limitLabel(pendingMicros ?? 0)}
            </strong>
          </p>
          <Feedback error={action.error} notice="" />
        </ConfirmDialog>
      )}
    </div>
  );
}
