import { describe, expect, it } from "vitest";
import {
  buildDraftMessages,
  descriptionToHtml,
  extractJsonObject,
  MAX_DRAFT_PAGE_CHARS,
  MAX_DRAFT_PAGES,
  normalizeDraftPages,
  normalizeDraftSource,
  parseProductDraft,
} from "@/lib/agent/draft";

const fullReply = JSON.stringify({
  name: "คู่มือสูตรขนมปัง 30 สูตร",
  price: 290,
  comparePrice: 490,
  description: "สูตรขนมปังโฮมเมด 30 สูตร\nพร้อมรูปประกอบทุกขั้นตอน\n\nเหมาะกับมือใหม่",
  highlights: ["30 สูตรพร้อมใช้", "วัดส่วนผสมเป็นกรัม"],
  faq: [{ question: "ไฟล์เป็นอะไร", answer: "PDF อ่านได้ทุกอุปกรณ์" }],
  imageAlt: "หน้าปกคู่มือสูตรขนมปัง",
  notes: "ราคามาจากหน้าปก กรุณาตรวจสอบอีกครั้ง",
});

describe("parseProductDraft", () => {
  it("maps a complete reply onto editor fields", () => {
    const draft = parseProductDraft(fullReply);
    expect(draft.name).toBe("คู่มือสูตรขนมปัง 30 สูตร");
    expect(draft.price).toBe("290");
    expect(draft.comparePrice).toBe("490");
    expect(draft.descriptionHtml).toBe(
      "<p>สูตรขนมปังโฮมเมด 30 สูตร พร้อมรูปประกอบทุกขั้นตอน</p><p>เหมาะกับมือใหม่</p>",
    );
    expect(draft.highlights).toEqual(["30 สูตรพร้อมใช้", "วัดส่วนผสมเป็นกรัม"]);
    expect(draft.faq).toHaveLength(1);
    expect(draft.faq[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft.notes).toContain("ราคามาจากหน้าปก");
  });

  it("drops a compare price that is not above the sale price", () => {
    expect(parseProductDraft(JSON.stringify({ price: 290, comparePrice: 200 })).comparePrice).toBe("");
    expect(parseProductDraft(JSON.stringify({ price: 290, comparePrice: 290 })).comparePrice).toBe("");
  });

  it("leaves the price empty when the document does not state one", () => {
    const draft = parseProductDraft(JSON.stringify({ name: "ไฟล์", price: null }));
    expect(draft.price).toBe("");
    expect(draft.comparePrice).toBe("");
  });

  it("rejects prices that are not usable amounts", () => {
    expect(parseProductDraft(JSON.stringify({ price: -5 })).price).toBe("");
    expect(parseProductDraft(JSON.stringify({ price: 0 })).price).toBe("");
    expect(parseProductDraft(JSON.stringify({ price: 99_000_000 })).price).toBe("");
    expect(parseProductDraft(JSON.stringify({ price: "฿1,290 บาท" })).price).toBe("1290");
  });

  it("strips any markup the model emits, in every field", () => {
    const draft = parseProductDraft(
      JSON.stringify({
        name: '<img src=x onerror="alert(1)">ชื่อ',
        description: "<script>alert(1)</script>ย่อหน้า",
        highlights: ["<b>เด่น</b>"],
        faq: [{ question: "<i>ถาม</i>", answer: "<p>ตอบ</p>" }],
        imageAlt: "<svg onload=x>ปก",
      }),
    );
    expect(draft.name).toBe("ชื่อ");
    expect(draft.descriptionHtml).toBe("<p>alert(1) ย่อหน้า</p>");
    expect(draft.highlights).toEqual(["เด่น"]);
    expect(draft.faq[0]).toMatchObject({ question: "ถาม", answer: "ตอบ" });
    expect(draft.imageAlt).toBe("ปก");
  });

  it("reads a reply wrapped in a markdown fence or trailing prose", () => {
    expect(parseProductDraft('```json\n{"name":"ชื่อ"}\n```').name).toBe("ชื่อ");
    expect(parseProductDraft('นี่คือ JSON: {"name":"ชื่อ"} หวังว่าจะช่วยได้').name).toBe("ชื่อ");
  });

  it("refuses a reply that carries no JSON object", () => {
    expect(() => parseProductDraft("ขอโทษครับ ผมอ่านไฟล์ไม่ได้")).toThrow("ไม่พบข้อมูล JSON");
    expect(() => parseProductDraft("{ไม่ใช่ json}")).toThrow("ไม่ใช่ JSON ที่อ่านได้");
    expect(() => parseProductDraft("[1,2,3]")).toThrow("ไม่พบข้อมูล JSON");
  });

  it("caps list fields so one reply cannot flood the form", () => {
    const draft = parseProductDraft(
      JSON.stringify({
        highlights: Array.from({ length: 30 }, (_, index) => `ข้อ ${index}`),
        faq: Array.from({ length: 30 }, (_, index) => ({ question: `ถาม ${index}`, answer: "ตอบ" })),
      }),
    );
    expect(draft.highlights).toHaveLength(6);
    expect(draft.faq).toHaveLength(5);
  });

  it("drops FAQ entries that are missing a side", () => {
    const draft = parseProductDraft(
      JSON.stringify({ faq: [{ question: "ถาม" }, { answer: "ตอบ" }, "ไม่ใช่ object"] }),
    );
    expect(draft.faq).toEqual([]);
  });
});

describe("extractJsonObject", () => {
  it("takes the outermost object", () => {
    expect(extractJsonObject('{"a":{"b":1}}')).toEqual({ a: { b: 1 } });
  });
});

describe("descriptionToHtml", () => {
  it("splits on blank lines and escapes the text", () => {
    expect(descriptionToHtml("ย่อหน้า & <หนึ่ง>\n\nย่อหน้าสอง")).toBe(
      "<p>ย่อหน้า &amp; &lt;หนึ่ง&gt;</p><p>ย่อหน้าสอง</p>",
    );
  });

  it("returns nothing for empty input", () => {
    expect(descriptionToHtml("")).toBe("");
    expect(descriptionToHtml("\n\n   \n")).toBe("");
  });
});

describe("normalizeDraftPages", () => {
  it("keeps at most the pages the agent is allowed to read", () => {
    const pages = normalizeDraftPages(
      Array.from({ length: 40 }, (_, index) => ({ pageNumber: index + 1, text: "เนื้อหา" })),
    );
    expect(pages).toHaveLength(MAX_DRAFT_PAGES);
    expect(pages.at(-1)?.pageNumber).toBe(MAX_DRAFT_PAGES);
  });

  it("truncates a single oversized page", () => {
    const [page] = normalizeDraftPages([{ pageNumber: 1, text: "ก".repeat(99_999) }]);
    expect(page.text).toHaveLength(MAX_DRAFT_PAGE_CHARS);
  });

  it("discards entries without usable text or a valid page number", () => {
    expect(
      normalizeDraftPages([
        { pageNumber: 1, text: "   " },
        { pageNumber: 0, text: "ok" },
        { pageNumber: 99, text: "ok" },
        { pageNumber: "x", text: "ok" },
        "nope",
        null,
      ]),
    ).toEqual([]);
  });

  it("returns nothing for a non-array payload", () => {
    expect(normalizeDraftPages(null)).toEqual([]);
    expect(normalizeDraftPages({ pageNumber: 1, text: "ok" })).toEqual([]);
  });
});

describe("buildDraftMessages", () => {
  it("sends a system prompt plus one labelled user message", () => {
    const messages = buildDraftMessages(
      [
        { pageNumber: 1, text: "หน้าหนึ่ง" },
        { pageNumber: 2, text: "หน้าสอง" },
      ],
      "guide.pdf",
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("JSON");
    expect(messages[1].content).toContain("guide.pdf");
    expect(messages[1].content).toContain("--- หน้า 1 ---");
    expect(messages[1].content).toContain("หน้าสอง");
    expect(messages[1].content).toContain("จำนวนหน้าที่อ่าน: 2");
  });
});

describe("normalizeDraftSource", () => {
  it("only trusts an explicit ocr marker", () => {
    expect(normalizeDraftSource("ocr")).toBe("ocr");
  });

  it("treats anything else as a real text layer", () => {
    // A request that lies about this would get the wrong prompt and the wrong
    // line on the admin page, so the default is the cheaper, stricter path.
    expect(normalizeDraftSource("layer")).toBe("layer");
    expect(normalizeDraftSource(undefined)).toBe("layer");
    expect(normalizeDraftSource("OCR")).toBe("layer");
    expect(normalizeDraftSource({ textSource: "ocr" })).toBe("layer");
  });
});

describe("buildDraftMessages with recognized text", () => {
  const pages = [{ pageNumber: 1, text: "คนทีเพิงเริมอบขนมปัง" }];

  it("tells the model the words came out of a page image", () => {
    const [system, user] = buildDraftMessages(pages, "scan.pdf", "ocr");
    expect(system.content).toContain("OCR");
    expect(user.content).toContain("วิธีอ่านข้อความ: OCR จากรูปภาพของหน้า");
  });

  it("asks for spelling to be repaired but never the numbers", () => {
    const [system] = buildDraftMessages(pages, "scan.pdf", "ocr");
    expect(system.content).toContain("ห้ามเปลี่ยนหรือเดาตัวเลข");
    expect(system.content).toContain("เดารูปคำที่ถูกต้องจากบริบท");
  });

  it("keeps the OCR warning out of a normal draft", () => {
    const [system, user] = buildDraftMessages(pages, "guide.pdf");
    expect(system.content).not.toContain("OCR");
    expect(user.content).toContain("วิธีอ่านข้อความ: ชั้นข้อความของ PDF");
  });

  it("still carries the same instructions either way", () => {
    const plain = buildDraftMessages(pages, "guide.pdf", "layer")[0].content;
    const scanned = buildDraftMessages(pages, "scan.pdf", "ocr")[0].content;
    expect(scanned.startsWith(plain)).toBe(true);
  });
});
