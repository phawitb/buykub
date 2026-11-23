"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatTHB } from "@/features/products/format";
import { PROMO_CODE_PATTERN, promoDiscountLabel } from "@/lib/promo/codes";

export type PromoCodeRow = {
  id: string;
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  product_ids: string[];
  max_redemptions: number | null;
  once_per_user: boolean;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  paid_uses: number;
};
type Product = { id: string; name: string; price_cents: number };

const input = "h-11 w-full rounded-lg border border-line bg-paper px-3.5 text-sm text-ink outline-none focus:border-ink";
const label = "mb-1.5 block text-xs font-medium text-ink-soft";

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
}

function status(code: PromoCodeRow, now: number) {
  if (!code.active) return { text: "ปิดอยู่", tone: "bg-paper-dim text-muted" };
  if (code.expires_at && new Date(code.expires_at).getTime() <= now) return { text: "หมดอายุ", tone: "bg-paper-dim text-muted" };
  if (code.max_redemptions != null && code.paid_uses >= code.max_redemptions) return { text: "ใช้ครบแล้ว", tone: "bg-paper-dim text-muted" };
  return { text: "ใช้งานอยู่", tone: "bg-emerald-50 text-emerald-700" };
}

export function PromoCodeManager({ shopId, initialCodes, products }: { shopId: string; initialCodes: PromoCodeRow[]; products: Product[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"all" | "some">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState("");
  const [expires, setExpires] = useState("");
  const [oncePerUser, setOncePerUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const productNames = new Map(products.map((product) => [product.id, product.name]));

  function validate() {
    if (!PROMO_CODE_PATTERN.test(code.trim().toUpperCase())) return "โค้ดต้องยาว 3–30 ตัว ใช้ได้เฉพาะ A–Z, 0–9, - และ _";
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 1) return kind === "percent" ? "กรอก % เป็นจำนวนเต็ม 1–100" : "กรอกจำนวนบาทเป็นจำนวนเต็ม";
    if (kind === "percent" && amount > 100) return "ลดได้ไม่เกิน 100%";
    if (scope === "some" && selected.length === 0) return "เลือกสินค้าอย่างน้อย 1 ชิ้น";
    if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1)) return "จำนวนครั้งต้องเป็นจำนวนเต็มตั้งแต่ 1";
    return null;
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await createClient().from("promo_codes").insert({
      shop_id: shopId,
      code: code.trim().toUpperCase(),
      percent_off: kind === "percent" ? Number(value) : null,
      amount_off_cents: kind === "amount" ? Number(value) * 100 : null,
      product_ids: scope === "some" ? selected : [],
      max_redemptions: limit ? Number(limit) : null,
      once_per_user: oncePerUser,
      // The end of the chosen day in Bangkok.
      expires_at: expires ? `${expires}T23:59:59+07:00` : null,
    }).select("id, code, percent_off, amount_off_cents, product_ids, max_redemptions, once_per_user, expires_at, active, created_at").single();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.code === "23505" ? "มีโค้ดนี้ในร้านแล้ว ใช้ชื่ออื่น" : "สร้างโค้ดไม่สำเร็จ กรุณาลองอีกครั้ง");
      return;
    }
    setCodes((current) => [{ ...data, paid_uses: 0 }, ...current]);
    setCode(""); setValue(""); setLimit(""); setExpires(""); setScope("all"); setSelected([]);
    router.refresh();
  }

  async function toggle(row: PromoCodeRow) {
    setBusyId(row.id);
    const { error: updateError } = await createClient().from("promo_codes").update({ active: !row.active }).eq("id", row.id);
    setBusyId(null);
    if (updateError) { setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
    setCodes((current) => current.map((item) => item.id === row.id ? { ...item, active: !row.active } : item));
  }

  async function remove(row: PromoCodeRow) {
    setBusyId(row.id);
    const { error: deleteError } = await createClient().from("promo_codes").delete().eq("id", row.id);
    setBusyId(null);
    setConfirmDelete(null);
    if (deleteError) { setError("ลบไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
    setCodes((current) => current.filter((item) => item.id !== row.id));
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={create} aria-label="สร้างโค้ดส่วนลด" className="space-y-5 rounded-2xl border border-line p-5">
        <h2 className="font-semibold text-ink">สร้างโค้ดใหม่</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="promo-code" className={label}>โค้ด</label>
            <input id="promo-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={30} placeholder="เช่น SAVE20" autoCapitalize="characters" autoComplete="off" spellCheck={false} className={`${input} font-mono uppercase placeholder:font-sans placeholder:normal-case`} />
          </div>
          <div>
            <span className={label}>ส่วนลด</span>
            <div className="flex gap-2">
              <div role="radiogroup" aria-label="ประเภทส่วนลด" className="inline-flex shrink-0 divide-x divide-line overflow-hidden rounded-lg border border-line">
                {(["percent", "amount"] as const).map((option) => (
                  <button key={option} type="button" role="radio" aria-checked={kind === option} onClick={() => setKind(option)} className={`h-11 px-3.5 text-sm font-medium ${kind === option ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:bg-paper-dim"}`}>
                    {option === "percent" ? "%" : "บาท"}
                  </button>
                ))}
              </div>
              <label htmlFor="promo-value" className="sr-only">{kind === "percent" ? "ลดกี่เปอร์เซ็นต์" : "ลดกี่บาท"}</label>
              <input id="promo-value" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))} placeholder={kind === "percent" ? "20" : "50"} className={input} />
            </div>
          </div>
        </div>

        <fieldset>
          <legend className={label}>ใช้กับสินค้า</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink">
            <label className="flex items-center gap-2"><input type="radio" name="promo-scope" checked={scope === "all"} onChange={() => setScope("all")} />ทุกสินค้าในร้าน</label>
            <label className="flex items-center gap-2"><input type="radio" name="promo-scope" checked={scope === "some"} onChange={() => setScope("some")} />เลือกสินค้า</label>
          </div>
          {scope === "some" && (
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {products.length === 0 && <p className="p-2 text-sm text-muted">ยังไม่มีสินค้า</p>}
              {products.map((product) => (
                <label key={product.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-paper-dim">
                  <input type="checkbox" checked={selected.includes(product.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} />
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  <span className="shrink-0 text-xs text-muted">{formatTHB(product.price_cents)}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="promo-limit" className={label}>จำนวนครั้งที่ใช้ได้ทั้งหมด</label>
            <input id="promo-limit" inputMode="numeric" value={limit} onChange={(event) => setLimit(event.target.value.replace(/\D/g, ""))} placeholder="ไม่จำกัด" className={input} />
          </div>
          <div>
            <label htmlFor="promo-expires" className={label}>ใช้ได้ถึงวันที่</label>
            <input id="promo-expires" type="date" value={expires} onChange={(event) => setExpires(event.target.value)} className={input} />
          </div>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={oncePerUser} onChange={(event) => setOncePerUser(event.target.checked)} />
          ผู้ซื้อ 1 บัญชีใช้ได้ครั้งเดียว
        </label>
        <p className="text-xs text-muted">ส่วนลดปัดเป็นบาทเต็ม ถ้าราคาหลังลดต่ำกว่า ฿10 (แต่ไม่ฟรี) จะใช้โค้ดกับสินค้านั้นไม่ได้ เพราะ PromptPay รับขั้นต่ำ ฿10</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="primary-button">{saving ? "กำลังสร้าง..." : "สร้างโค้ด"}</button>
      </form>

      <section aria-label="โค้ดของร้าน">
        <h2 className="mb-3 text-sm font-semibold text-ink">โค้ดของร้าน {codes.length > 0 && <span className="font-normal text-muted">({codes.length})</span>}</h2>
        {codes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">ยังไม่มีโค้ดส่วนลด</p>
        ) : (
          <ul className="space-y-3">
            {codes.map((row) => {
              const state = status(row, now);
              const scopeText = row.product_ids.length === 0
                ? "ทุกสินค้า"
                : row.product_ids.length === 1 ? productNames.get(row.product_ids[0]) ?? "1 สินค้า" : `${row.product_ids.length} สินค้า`;
              return (
                <li key={row.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-semibold text-ink">{row.code}</span>
                        <span className="text-sm font-semibold text-red-600">{promoDiscountLabel(row)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.tone}`}>{state.text}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {[
                          scopeText,
                          `ใช้แล้ว ${row.paid_uses.toLocaleString("th-TH")}${row.max_redemptions != null ? ` / ${row.max_redemptions.toLocaleString("th-TH")}` : ""} ครั้ง`,
                          row.expires_at ? `ถึง ${dateLabel(row.expires_at)}` : "ไม่มีวันหมดอายุ",
                          row.once_per_user ? "1 ครั้งต่อบัญชี" : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" disabled={busyId === row.id} onClick={() => toggle(row)} className="h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink-soft hover:bg-paper-dim disabled:opacity-50">
                        {row.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                      {confirmDelete === row.id ? (
                        <button type="button" disabled={busyId === row.id} onClick={() => remove(row)} className="h-9 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">ยืนยันลบ</button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(row.id)} className="h-9 rounded-lg border border-line px-3 text-xs font-medium text-red-600 hover:bg-red-50">ลบ</button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
