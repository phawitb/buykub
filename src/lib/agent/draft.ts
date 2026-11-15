import type { ProductDraft } from "@/lib/agent/model";

export const MAX_DRAFT_PAGES = 10;
export const MAX_DRAFT_PAGE_CHARS = 4000;
export const MAX_DRAFT_HIGHLIGHTS = 6;
export const MAX_DRAFT_FAQ = 5;

export type DraftPage = { pageNumber: number; text: string };

const SYSTEM_PROMPT = [
  "คุณช่วยผู้ขายชาวไทยลงสินค้าดิจิทัลบนร้านค้าออนไลน์",
  "ผู้ใช้จะส่งข้อความที่ดึงมาจากไฟล์ PDF ของสินค้า (อ่านได้สูงสุด 10 หน้าแรก)",
  "หน้าที่ของคุณคือร่างข้อมูลสินค้าจากเนื้อหานั้น",
  "",
  "ตอบกลับเป็น JSON object เท่านั้น ห้ามมีข้อความอื่นหรือ markdown fence โดยมีคีย์:",
  '  "name": ชื่อสินค้าภาษาไทย กระชับ ไม่เกิน 80 ตัวอักษร',
  '  "price": ราคาขายเป็นบาท (ตัวเลข) หรือ null ถ้าเดาไม่ได้',
  '  "comparePrice": ราคาเดิมก่อนลด (ตัวเลข ต้องมากกว่า price) หรือ null',
  '  "description": คำอธิบายสินค้า 2-4 ย่อหน้า ข้อความล้วน ไม่ใส่ HTML คั่นย่อหน้าด้วย \\n\\n',
  '  "highlights": จุดเด่น 3-6 ข้อ แต่ละข้อสั้น ไม่เกิน 80 ตัวอักษร',
  '  "faq": คำถามที่พบบ่อย 2-5 ข้อ แต่ละข้อเป็น {"question","answer"}',
  '  "imageAlt": คำบรรยายภาพหน้าปกสั้น ๆ สำหรับผู้ใช้โปรแกรมอ่านหน้าจอ',
  '  "notes": สิ่งที่ผู้ขายควรตรวจสอบหรือแก้เอง เช่น ราคาที่คุณเดา (ภาษาไทย 1-2 ประโยค)',
  "",
  "กติกา: ใช้ข้อมูลจาก PDF เท่านั้น ห้ามแต่งคุณสมบัติที่ไม่มีในเอกสาร",
  "ถ้าเอกสารไม่ได้ระบุราคา ให้ price เป็น null และบอกใน notes",
  "เขียนด้วยน้ำเสียงที่ขายได้แต่ไม่โอ้อวดเกินจริง ห้ามใส่แท็ก HTML ในทุกฟิลด์",
].join("\n");

export function buildDraftMessages(pages: readonly DraftPage[], fileName: string) {
  const document = pages
    .slice(0, MAX_DRAFT_PAGES)
    .map((page) => `--- หน้า ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `ชื่อไฟล์: ${fileName}\nจำนวนหน้าที่อ่าน: ${Math.min(
        pages.length,
        MAX_DRAFT_PAGES,
      )}\n\n${document}`,
    },
  ];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The model writes plain text; the editor stores HTML, so paragraphs are built here. */
export function descriptionToHtml(description: string): string {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!paragraphs.length) return "";
  return paragraphs.map((text) => `<p>${escapeHtml(text.slice(0, 1200))}</p>`).join("");
}

function plainText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function amount(value: unknown): string {
  const parsed = typeof value === "string" ? Number(value.replace(/[^\d.]/g, "")) : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10_000_000) return "";
  return String(Math.round(parsed * 100) / 100);
}

/** Pulls the JSON object out of a reply that may carry a fence or stray prose. */
export function extractJsonObject(content: string): unknown {
  const unfenced = content.replace(/```(?:json)?/gi, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("ไม่พบข้อมูล JSON ในคำตอบของ AI");
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    throw new Error("คำตอบของ AI ไม่ใช่ JSON ที่อ่านได้");
  }
}

export function parseProductDraft(content: string): ProductDraft {
  const raw = extractJsonObject(content);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("คำตอบของ AI ไม่ใช่ JSON ที่อ่านได้");
  }
  const source = raw as Record<string, unknown>;

  const price = amount(source.price);
  const comparePriceRaw = amount(source.comparePrice);
  // The editor rejects a compare price at or below the sale price, so a bad
  // suggestion is dropped here rather than blocking the confirm step.
  const comparePrice =
    comparePriceRaw && price && Number(comparePriceRaw) > Number(price) ? comparePriceRaw : "";

  const highlights = (Array.isArray(source.highlights) ? source.highlights : [])
    .map((item) => plainText(item, 80))
    .filter(Boolean)
    .slice(0, MAX_DRAFT_HIGHLIGHTS);

  const faq = (Array.isArray(source.faq) ? source.faq : [])
    .map((item) => {
      const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        id: crypto.randomUUID(),
        question: plainText(entry.question, 200),
        answer: plainText(entry.answer, 1000),
      };
    })
    .filter((item) => item.question && item.answer)
    .slice(0, MAX_DRAFT_FAQ);

  return {
    name: plainText(source.name, 80),
    price,
    comparePrice,
    descriptionHtml: descriptionToHtml(
      typeof source.description === "string" ? source.description.replace(/<[^>]*>/g, " ") : "",
    ),
    highlights,
    faq,
    imageAlt: plainText(source.imageAlt, 120),
    notes: plainText(source.notes, 400),
  };
}

/** Trims pages to what the request is allowed to carry. */
export function normalizeDraftPages(raw: unknown): DraftPage[] {
  if (!Array.isArray(raw)) return [];
  const pages: DraftPage[] = [];
  for (const item of raw.slice(0, MAX_DRAFT_PAGES)) {
    const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const pageNumber = Math.round(Number(entry.pageNumber));
    const text = typeof entry.text === "string" ? entry.text.trim().slice(0, MAX_DRAFT_PAGE_CHARS) : "";
    if (!text || !Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > MAX_DRAFT_PAGES) {
      continue;
    }
    pages.push({ pageNumber, text });
  }
  return pages;
}
