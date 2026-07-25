"use client";

import { useState } from "react";

const PLANS = [
  {
    name: "Free",
    monthly: 0,
    annual: 0,
    features: [
      "สินค้าสูงสุด 5 ชิ้น",
      "บริการจองสูงสุด 5 รายการ",
      "ค่าธรรมเนียม Framelink 8%",
      "Framelink watermark",
      "หน้าร้านพื้นฐาน",
    ],
  },
  {
    name: "Pro",
    monthly: 399,
    annual: 3990,
    featured: true,
    features: [
      "สินค้าไม่จำกัด",
      "บริการจองไม่จำกัด",
      "ค่าธรรมเนียม Framelink 2%",
      "ไม่มี watermark",
    ],
  },
  {
    name: "Pro+",
    monthly: 899,
    annual: 8990,
    features: [
      "ทุกอย่างใน Pro",
      "ค่าธรรมเนียม Framelink 0%",
      "Custom domain (เร็ว ๆ นี้)",
      "Priority support",
    ],
  },
];

export function UpgradePlans() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  return (
    <>
      <div className="inline-flex rounded-full border border-line bg-paper-dim p-1">
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className={`rounded-full px-5 py-2 text-xs font-semibold ${
            billing === "monthly" ? "bg-paper text-ink shadow-sm" : "text-muted"
          }`}
        >
          รายเดือน
        </button>
        <button
          type="button"
          onClick={() => setBilling("annual")}
          className={`rounded-full px-5 py-2 text-xs font-semibold ${
            billing === "annual" ? "bg-paper text-ink shadow-sm" : "text-muted"
          }`}
        >
          รายปี <span className="text-accent">ประหยัด 2 เดือน</span>
        </button>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = billing === "monthly" ? plan.monthly : plan.annual;
          return (
            <article
              key={plan.name}
              className={`relative rounded-3xl border p-6 ${
                plan.featured
                  ? "border-accent bg-accent-soft/50"
                  : "border-line bg-paper"
              }`}
            >
              {plan.featured && (
                <span className="absolute right-5 top-5 rounded-full bg-accent px-3 py-1 text-[10px] font-bold text-paper">
                  แนะนำ
                </span>
              )}
              <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
              <p className="mt-5 text-3xl font-bold text-ink">
                ฿{price.toLocaleString("th-TH")}
                {price > 0 && (
                  <span className="ml-1 text-xs font-normal text-muted">
                    /{billing === "monthly" ? "เดือน" : "ปี"}
                  </span>
                )}
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink-soft">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.name === "Free" ? (
                <span className="secondary-button mt-7 block text-center">
                  แผนปัจจุบัน
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setCheckoutPlan(plan.name)}
                  className="primary-button mt-7 w-full"
                >
                  เริ่มใช้ {plan.name}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-paper-dim text-ink">
            <tr>
              <th className="p-4">ฟีเจอร์</th>
              <th className="p-4">Free</th>
              <th className="p-4">Pro</th>
              <th className="p-4">Pro+</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-ink-soft">
            {[
              ["สินค้า", "5 ชิ้น", "ไม่จำกัด", "ไม่จำกัด"],
              ["บริการจอง", "5 รายการ", "ไม่จำกัด", "ไม่จำกัด"],
              ["ค่าธรรมเนียม Framelink", "8%", "2%", "0%"],
              ["Watermark", "มี", "ไม่มี", "ไม่มี"],
              ["Custom domain", "—", "—", "เร็ว ๆ นี้"],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={cell} className={`p-4 ${index === 0 ? "font-medium text-ink" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-checkout-title"
            className="w-full max-w-sm rounded-3xl bg-paper p-6 shadow-2xl"
          >
            <h2 id="upgrade-checkout-title" className="text-xl font-bold text-ink">
              อัปเกรดเป็น {checkoutPlan}
            </h2>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              ตัวอย่างเท่านั้น — ยังไม่มีการเรียกเก็บเงินจริง
            </p>
            <button
              type="button"
              onClick={() => setCheckoutPlan(null)}
              className="primary-button mt-5 w-full"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  );
}
