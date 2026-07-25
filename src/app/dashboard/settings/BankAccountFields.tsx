"use client";

import { useEffect, useMemo, useState } from "react";
import {
  THAI_BANKS,
  filterThaiBanks,
  getThaiBank,
  type BankAccountErrors,
  type BankDetails,
  type ThaiBank,
} from "./thai-banks";

export function BankAccountFields({
  value,
  onChange,
  errors = {},
}: {
  value: BankDetails;
  onChange: (value: BankDetails) => void;
  errors?: BankAccountErrors;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedBank = getThaiBank(value.bankCode);
  const filteredBanks = useMemo(() => filterThaiBanks(query), [query]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function selectBank(bank: ThaiBank) {
    onChange({ ...value, bankCode: bank.code, legacy: "" });
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="space-y-4">
      {value.legacy && !selectedBank && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-950">ข้อมูลบัญชีเดิม</p>
          <p className="mt-1 break-words text-xs leading-5 text-amber-900">
            {value.legacy}
          </p>
          <p className="mt-2 text-[11px] text-amber-800">
            เลือกธนาคารและกรอกข้อมูลใหม่เพื่อเปลี่ยนเป็นรูปแบบล่าสุด
          </p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">
          ธนาคาร
        </label>
        <button
          type="button"
          aria-label={selectedBank ? `เปลี่ยนธนาคาร ${selectedBank.nameTh}` : "เลือกธนาคาร"}
          onClick={() => setOpen(true)}
          className={`flex w-full items-center gap-3 rounded-xl border bg-paper p-3 text-left transition hover:border-ink ${
            errors.bankCode ? "border-red-400" : "border-line"
          }`}
        >
          {selectedBank ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedBank.logo}
                alt={selectedBank.shortName}
                className="h-11 w-11 rounded-full object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {selectedBank.nameTh}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {selectedBank.shortName} · {selectedBank.nameEn}
                </span>
              </span>
              <span className="text-xs font-semibold text-accent">เปลี่ยน</span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-dim text-lg text-muted"
              >
                ▤
              </span>
              <span className="flex-1 text-sm font-medium text-ink">
                เลือกธนาคาร
              </span>
              <span aria-hidden className="text-xl text-muted">
                ›
              </span>
            </>
          )}
        </button>
        {errors.bankCode && (
          <p className="mt-1.5 text-xs text-red-600">{errors.bankCode}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="bank-account-number"
            className="mb-1.5 block text-xs font-medium text-ink-soft"
          >
            เลขบัญชี
          </label>
          <input
            id="bank-account-number"
            value={value.accountNumber}
            onChange={(event) =>
              onChange({
                ...value,
                accountNumber: event.target.value.replace(/\D/g, "").slice(0, 16),
              })
            }
            inputMode="numeric"
            autoComplete="off"
            placeholder="เลขบัญชี 6–16 หลัก"
            className={`w-full rounded-lg border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink ${
              errors.accountNumber ? "border-red-400" : "border-line"
            }`}
          />
          {errors.accountNumber && (
            <p className="mt-1.5 text-xs text-red-600">{errors.accountNumber}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="bank-account-name"
            className="mb-1.5 block text-xs font-medium text-ink-soft"
          >
            ชื่อบัญชี
          </label>
          <input
            id="bank-account-name"
            value={value.accountName}
            onChange={(event) =>
              onChange({ ...value, accountName: event.target.value })
            }
            autoComplete="name"
            placeholder="ชื่อเจ้าของบัญชี"
            className={`w-full rounded-lg border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink ${
              errors.accountName ? "border-red-400" : "border-line"
            }`}
          />
          {errors.accountName && (
            <p className="mt-1.5 text-xs text-red-600">{errors.accountName}</p>
          )}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-picker-title"
            className="flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-paper shadow-2xl sm:max-w-xl sm:rounded-3xl"
          >
            <div className="border-b border-line px-5 pb-4 pt-5 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 id="bank-picker-title" className="text-lg font-bold text-ink">
                    เลือกธนาคารรับเงิน
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    เฉพาะธนาคารที่รองรับการโอนในประเทศไทย
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="ปิด"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-dim text-lg text-muted hover:text-ink"
                >
                  ×
                </button>
              </div>
              <div className="relative mt-4">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                >
                  ⌕
                </span>
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาชื่อธนาคารหรือรหัส"
                  className="w-full rounded-xl border border-line bg-paper-dim py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
            </div>

            <div className="overflow-y-auto px-3 py-3 sm:px-4">
              {!query && (
                <BankGroup
                  title="ธนาคารยอดนิยม"
                  banks={THAI_BANKS.filter((bank) => bank.popular)}
                  selectedCode={value.bankCode}
                  onSelect={selectBank}
                />
              )}
              <BankGroup
                title={query ? "ผลการค้นหา" : "ธนาคารทั้งหมด"}
                banks={
                  query
                    ? filteredBanks
                    : THAI_BANKS.filter((bank) => !bank.popular)
                }
                selectedCode={value.bankCode}
                onSelect={selectBank}
              />
              {filteredBanks.length === 0 && (
                <p className="px-3 py-12 text-center text-sm text-muted">
                  ไม่พบธนาคารที่ค้นหา
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BankGroup({
  title,
  banks,
  selectedCode,
  onSelect,
}: {
  title: string;
  banks: ThaiBank[];
  selectedCode: string;
  onSelect: (bank: ThaiBank) => void;
}) {
  if (banks.length === 0) return null;
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {title}
      </h3>
      <div className="overflow-hidden rounded-2xl border border-line">
        {banks.map((bank) => (
          <button
            key={bank.code}
            type="button"
            aria-label={`${bank.nameTh} ${bank.shortName}`}
            onClick={() => onSelect(bank)}
            className="flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left transition last:border-b-0 hover:bg-paper-dim"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bank.logo}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">
                {bank.nameTh}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {bank.nameEn}
              </span>
            </span>
            <span
              aria-hidden
              className={selectedCode === bank.code ? "text-accent" : "text-muted"}
            >
              {selectedCode === bank.code ? "✓" : "›"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
