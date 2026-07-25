"use client";

import { useState } from "react";

const faqs = [
  {
    q: "ค่าธรรมเนียมคิดยังไง?",
    a: "แพลน Free คิด 8% ต่อรายการที่ขายได้เท่านั้น ไม่ขายไม่เสียอะไร แพลน Pro 2% และ Pro+ 0% ไม่มีค่าแรกเข้าหรือค่าซ่อนอื่น",
  },
  {
    q: "ขายแล้วได้เงินเมื่อไหร่?",
    a: "โอนเงินเข้าบัญชีทุกวันจันทร์ หลังพ้นระยะเวลาตรวจสอบมาตรฐานของแต่ละยอดขาย",
  },
  {
    q: "ต้องจดทะเบียนธุรกิจไหม?",
    a: "ไม่ต้อง บุคคลธรรมดาเปิดร้านขายได้เลย ส่วนภาษีเงินได้ให้ผู้ขายยื่นเองตามปกติ",
  },
  {
    q: "ลูกค้าจ่ายเงินยังไงได้บ้าง?",
    a: "รองรับพร้อมเพย์และบัตรเครดิต/เดบิต ผ่านระบบชำระเงินมาตรฐาน ยืนยันการจ่ายอัตโนมัติ",
  },
  {
    q: "ขายอะไรได้บ้าง?",
    a: "สินค้าดิจิทัลทุกแบบ เช่น e-book, template, ไฟล์เสียง/วิดีโอ และบริการจองคิวแบบ 1:1",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="border-t border-line bg-paper-dim py-24">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          FAQ
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          คำถามที่พบบ่อย
        </h2>

        <div className="mt-10 divide-y divide-line border-y border-line">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between py-5 text-left"
                >
                  <span className="font-medium text-ink">{f.q}</span>
                  <span className="text-xl text-muted">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <p className="pb-5 text-sm leading-relaxed text-ink-soft">{f.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
