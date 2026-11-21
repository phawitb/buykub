import type { ProductDraft } from "@/lib/agent/model";

export const MAX_DRAFT_PAGES = 10;
export const MAX_DRAFT_PAGE_CHARS = 4000;
export const MAX_DRAFT_HIGHLIGHTS = 6;
export const MAX_DRAFT_FAQ = 5;

export type DraftPage = { pageNumber: number; text: string };

/** Whether the text came off the PDF's own text layer or out of a page image. */
export type DraftTextSource = "layer" | "ocr";

const SYSTEM_PROMPT = [
  "คุณช่วยผู้ขายชาวไทยลงสินค้าดิจิทัลบนร้านค้าออนไลน์",
  "ผู้ใช้จะส่งข้อความที่ดึงมาจากไฟล์ PDF ของสินค้า (อ่านได้สูงสุด 10 หน้าแรก)",
  "หน้าที่ของคุณคือร่างข้อมูลสินค้าจากเนื้อหานั้น",
  "",
  "ตอบกลับเป็น JSON object เท่านั้น ห้ามมีข้อความอื่นหรือ markdown fence โดยมีคีย์:",
  '  "name": ชื่อสินค้าภาษาไทย กระชับ ไม่เกิน 80 ตัวอักษร',
  '  "price": ราคาขายเป็นบาท (ตัวเลข) หรือ null ถ้าเดาไม่ได้',
  '  "comparePrice": ราคาเดิมก่อนลด (ตัวเลข ต้องมากกว่า price) หรือ null',
  '  "description": รายการบล็อก 4-8 บล็อก เรียงตามลำดับที่ต้องการให้อ่าน แต่ละบล็อกเป็น object แบบใดแบบหนึ่ง:',
  '      {"type":"paragraph","text":"ย่อหน้าอธิบาย"}',
  '      {"type":"heading","text":"หัวข้อสั้น ๆ ไม่เกิน 60 ตัวอักษร"}',
  '      {"type":"bullets","items":["ข้อย่อย","ข้อย่อย"]}',
  '    ขึ้นต้นด้วย paragraph แนะนำสินค้า 1 ย่อหน้า แล้วแบ่งเนื้อหาที่เหลือเป็นหัวข้อ',
  '    เช่น "ในไฟล์มีอะไรบ้าง" "เหมาะกับใคร" "ได้อะไรหลังอ่านจบ" โดยใต้หัวข้อให้ใช้ bullets เป็นหลัก',
  '    เน้นให้อ่านเร็ว: bullets ข้อละไม่เกิน 100 ตัวอักษร ใช้ย่อหน้ายาวเท่าที่จำเป็น',
  '    ทำตัวหนาด้วย **ข้อความ** ได้ ใช้เน้นคำสำคัญเท่านั้น ไม่เกิน 2 จุดต่อบล็อก',
  '  "highlights": จุดเด่น 3-6 ข้อ แต่ละข้อสั้น ไม่เกิน 80 ตัวอักษร',
  '  "faq": คำถามที่พบบ่อย 2-5 ข้อ แต่ละข้อเป็น {"question","answer"}',
  '  "imageAlt": คำบรรยายภาพหน้าปกสั้น ๆ สำหรับผู้ใช้โปรแกรมอ่านหน้าจอ',
  '  "notes": สิ่งที่ผู้ขายควรตรวจสอบหรือแก้เอง เช่น ราคาที่คุณเดา (ภาษาไทย 1-2 ประโยค)',
  "",
  "กติกา: ใช้ข้อมูลจาก PDF เท่านั้น ห้ามแต่งคุณสมบัติที่ไม่มีในเอกสาร",
  "ถ้าเอกสารไม่ได้ระบุราคา ให้ price เป็น null และบอกใน notes",
  "เขียนด้วยน้ำเสียงที่ขายได้แต่ไม่โอ้อวดเกินจริง ห้ามใส่แท็ก HTML หรือ markdown อื่นนอกจาก ** ในทุกฟิลด์",
].join("\n");

/**
 * Recognized text arrives with Thai tone marks missing and Latin words turned
 * into unreadable Thai, which a reader repairs from context and the model can
 * too. Numbers are the exception: a misread price is indistinguishable from a
 * real one, so the model is told to pass them through or leave them out.
 */
const OCR_PROMPT = [
  "สำคัญ: ข้อความด้านล่างไม่ได้มาจากชั้นข้อความของ PDF แต่มาจากการอ่านตัวอักษรจากรูปภาพ (OCR)",
  "จึงมักมีวรรณยุกต์หรือสระหาย คำสะกดเพี้ยน และคำภาษาอังกฤษกลายเป็นตัวอักษรไทยที่อ่านไม่ได้",
  "ให้คุณเดารูปคำที่ถูกต้องจากบริบทภาษาไทยแล้วเขียนใหม่ให้สะกดถูก",
  "เช่น 'คนทีเพิงเริม' หมายถึง 'คนที่เพิ่งเริ่ม' และคำที่อ่านไม่ออกข้างคำว่า 'ไฟล์' มักหมายถึง 'PDF'",
  "ห้ามคัดลอกคำที่สะกดผิดหรืออ่านไม่ออกไปใส่ในคำตอบ",
  "แต่ห้ามเปลี่ยนหรือเดาตัวเลขที่เป็นราคา จำนวนหน้า หรือขนาด ให้ใช้ตามที่อ่านได้เท่านั้น",
  "ถ้าตัวเลขใดดูไม่สมเหตุสมผล ให้เว้นเป็น null แล้วเตือนผู้ขายใน notes ว่าต้องตรวจเอง",
].join("\n");

export function buildDraftMessages(
  pages: readonly DraftPage[],
  fileName: string,
  source: DraftTextSource = "layer",
) {
  const document = pages
    .slice(0, MAX_DRAFT_PAGES)
    .map((page) => `--- หน้า ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  return [
    {
      role: "system" as const,
      content: source === "ocr" ? `${SYSTEM_PROMPT}\n\n${OCR_PROMPT}` : SYSTEM_PROMPT,
    },
    {
      role: "user" as const,
      content: `ชื่อไฟล์: ${fileName}\nจำนวนหน้าที่อ่าน: ${Math.min(
        pages.length,
        MAX_DRAFT_PAGES,
      )}\nวิธีอ่านข้อความ: ${
        source === "ocr" ? "OCR จากรูปภาพของหน้า" : "ชั้นข้อความของ PDF"
      }\n\n${document}`,
    },
  ];
}

/** Only a request that says so is treated as recognized text. */
export function normalizeDraftSource(raw: unknown): DraftTextSource {
  return raw === "ocr" ? "ocr" : "layer";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** At most this many blocks, so one reply cannot fill the editor. */
const MAX_DESCRIPTION_BLOCKS = 12;
const MAX_BULLETS_PER_BLOCK = 8;

/**
 * Inline emphasis, written as **text** because the model is not allowed to
 * send HTML. Applied after escaping, so the tags can only be the ones here.
 */
function emphasize(escaped: string): string {
  return escaped.replace(/\*\*(?!\s)([^*]{1,120}?)\*\*/g, "<strong>$1</strong>");
}

function inline(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  // Any tag the model sends anyway is dropped, not escaped into view.
  const trimmed = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return trimmed ? emphasize(escapeHtml(trimmed)) : "";
}

/**
 * The seller skims the description before publishing, and so does the buyer.
 * Headings and bullets are what make a page skimmable, and the editor and the
 * storefront both style them, so the model answers in blocks rather than prose
 * and the tags are built here — it never sends HTML itself.
 */
function blockToHtml(raw: unknown): string {
  if (typeof raw === "string") {
    const text = inline(raw, 1200);
    return text ? `<p>${text}</p>` : "";
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const block = raw as Record<string, unknown>;
  const type = typeof block.type === "string" ? block.type.toLowerCase() : "";

  if (type === "heading") {
    const text = inline(block.text ?? block.title, 80);
    return text ? `<h2>${text}</h2>` : "";
  }
  if (type === "bullets" || type === "list" || Array.isArray(block.items)) {
    const items = (Array.isArray(block.items) ? block.items : [])
      .map((item) => inline(typeof item === "object" && item ? (item as Record<string, unknown>).text : item, 160))
      .filter(Boolean)
      .slice(0, MAX_BULLETS_PER_BLOCK);
    return items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : "";
  }
  const text = inline(block.text ?? block.content, 1200);
  return text ? `<p>${text}</p>` : "";
}

/**
 * Builds the editor's HTML from whatever the model sent: the blocks it is
 * asked for, or — when it falls back to prose, as a model under pressure
 * does — plain text split on blank lines.
 */
export function descriptionToHtml(description: unknown): string {
  if (Array.isArray(description)) {
    return description
      .slice(0, MAX_DESCRIPTION_BLOCKS)
      .map(blockToHtml)
      .filter(Boolean)
      .join("");
  }
  if (typeof description !== "string") return "";
  const paragraphs = description
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!paragraphs.length) return "";
  return paragraphs.map((text) => `<p>${emphasize(escapeHtml(text.slice(0, 1200)))}</p>`).join("");
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
      typeof source.description === "string"
        ? source.description.replace(/<[^>]*>/g, " ")
        : source.description,
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
