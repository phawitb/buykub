"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "./icons";

const faqs = [
  {
    q: "ค่าธรรมเนียมคิดยังไง?",
    a: "BUYKUB คิดค่าธรรมเนียม 5% ต่อออเดอร์ที่ขายได้เท่านั้น ไม่มีค่าแรกเข้า ค่าสมาชิกรายเดือน หรือค่าธรรมเนียมแพลนซ่อนอยู่",
  },
  {
    q: "ขายแล้วได้เงินเมื่อไหร่?",
    a: "ยอดที่ลูกค้าชำระแล้วจะเข้ารอบจ่ายหลังพ้นระยะถือครอง 7 วัน หลังจากนั้นทีมงานจะโอนเข้าบัญชีที่คุณกรอกไว้ในหน้าตั้งค่า และแนบสลิปยืนยันการโอนให้ทุกครั้ง ยังไม่มีระบบโอนอัตโนมัติ",
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
    a: "สินค้าดิจิทัลทุกแบบ เช่น e-book, template, ไฟล์เสียง/วิดีโอ คีย์สินค้า และคอร์สออนไลน์",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl text-ink sm:text-[2.5rem]">คำถามที่เจอบ่อย</h2>
        <p className="mt-4 text-[15px] leading-7 text-ink-soft">
          รวมคำตอบเรื่องการเปิดร้าน การขายสินค้า การรับเงิน และค่าธรรมเนียม
        </p>

        <div className="card mt-10 divide-y divide-line px-6">
          {faqs.map((faq, index) => {
            const isOpen = open === index;
            const panelId = `faq-panel-${index}`;
            return (
              <div key={faq.q}>
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="group flex w-full items-center justify-between gap-6 py-5 text-left"
                  >
                    <span className="font-medium text-ink transition-colors group-hover:text-accent-text">
                      {faq.q}
                    </span>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-muted transition duration-[160ms] ease-out group-hover:border-accent group-hover:text-accent-text">
                      {isOpen ? <MinusIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
                    </span>
                  </button>
                </h3>
                {isOpen && (
                  <p id={panelId} className="pb-6 pr-12 text-sm leading-7 text-ink-soft">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
