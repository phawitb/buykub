"use client";

import { useState } from "react";
import type { ProductFAQ } from "@/features/products/model";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function HighlightFields({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const next = draft.trim();
    if (!next) return;
    onChange([...value, next]);
    setDraft("");
  }

  return (
    <section className="product-section">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="product-section-title">จุดเด่น</h2>
          <p className="product-help">เช่น “100 prompts”, “PDF + Notion”</p>
        </div>
        <button type="button" onClick={add} className="small-button">
          เพิ่ม
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {value.map((highlight, index) => (
          <div key={`${highlight}-${index}`} className="repeatable-row">
            <input
              value={highlight}
              aria-label={`จุดเด่น ${index + 1}`}
              onChange={(event) =>
                onChange(
                  value.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
              className="field-input border-0 bg-transparent"
            />
            <button
              type="button"
              aria-label={`เลื่อนจุดเด่น ${index + 1} ขึ้น`}
              disabled={index === 0}
              className="small-button disabled:opacity-30"
              onClick={() => onChange(move(value, index, -1))}
            >
              <ArrowUpIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`เลื่อนจุดเด่น ${index + 1} ลง`}
              disabled={index === value.length - 1}
              className="small-button disabled:opacity-30"
              onClick={() => onChange(move(value, index, 1))}
            >
              <ArrowDownIcon className="size-3.5" />
            </button>
            <button
              type="button"
              className="small-button text-red-600"
              onClick={() =>
                onChange(value.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              ลบ
            </button>
          </div>
        ))}
        <input
          value={draft}
          aria-label="เพิ่มจุดเด่น"
          placeholder="เพิ่มจุดเด่นของสินค้า"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className="field-input"
        />
      </div>
    </section>
  );
}

export function FAQFields({
  value,
  onChange,
}: {
  value: ProductFAQ[];
  onChange: (value: ProductFAQ[]) => void;
}) {
  function add() {
    onChange([
      ...value,
      { id: crypto.randomUUID(), question: "", answer: "" },
    ]);
  }

  return (
    <section className="product-section">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="product-section-title">คำถามที่พบบ่อย (FAQ)</h2>
          <p className="product-help">ตอบคำถามที่ลูกค้ามักสงสัย</p>
        </div>
        <button type="button" onClick={add} className="small-button">
          เพิ่ม
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {value.map((faq, index) => (
          <div key={faq.id} className="rounded-2xl border border-line p-4">
            <input
              value={faq.question}
              aria-label={`คำถาม ${index + 1}`}
              placeholder="คำถาม"
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item.id === faq.id
                      ? { ...item, question: event.target.value }
                      : item,
                  ),
                )
              }
              className="field-input"
            />
            <textarea
              value={faq.answer}
              aria-label={`คำตอบ ${index + 1}`}
              placeholder="คำตอบ"
              rows={3}
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item.id === faq.id
                      ? { ...item, answer: event.target.value }
                      : item,
                  ),
                )
              }
              className="field-input mt-2 resize-y"
            />
            <button
              type="button"
              aria-label={`เลื่อนคำถาม ${index + 1} ขึ้น`}
              disabled={index === 0}
              className="small-button mt-2 disabled:opacity-30"
              onClick={() => onChange(move(value, index, -1))}
            >
              <ArrowUpIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`เลื่อนคำถาม ${index + 1} ลง`}
              disabled={index === value.length - 1}
              className="small-button mt-2 disabled:opacity-30"
              onClick={() => onChange(move(value, index, 1))}
            >
              <ArrowDownIcon className="size-3.5" />
            </button>
            <button
              type="button"
              className="small-button mt-2 text-red-600"
              onClick={() => onChange(value.filter((item) => item.id !== faq.id))}
            >
              ลบคำถาม
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
