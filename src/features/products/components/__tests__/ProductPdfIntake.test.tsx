import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductPdfIntake, readingLabel } from "@/features/products/components/ProductPdfIntake";
import { DEFAULT_PDF_PREVIEW_PREFERENCES } from "@/features/products/pdf/preferences";
import type { ProductDraftResponse } from "@/lib/agent/model";
import type { UploadRequest } from "@/lib/supabase/upload";

const pdf = vi.hoisted(() => ({ extractPdf: vi.fn(), releasePdfExtraction: vi.fn() }));
vi.mock("@/features/products/pdf/extract", () => pdf);

function previewFile(name: string) {
  return new File(["image"], name, { type: "image/webp" });
}

const extraction = {
  pageCount: 12,
  truncated: true,
  textSource: "layer" as const,
  textPagesRead: 10,
  pages: [
    { pageNumber: 1, text: "หน้าหนึ่ง" },
    { pageNumber: 2, text: "หน้าสอง" },
  ],
  previews: [
    {
      pageNumber: 1,
      protection: { blur: false, watermark: false },
      file: previewFile("page-1.png"),
      previewUrl: "blob:1",
      source: previewFile("page-1.png"),
    },
    {
      pageNumber: 2,
      protection: { blur: false, watermark: true },
      file: previewFile("page-2.png"),
      previewUrl: "blob:2",
      source: previewFile("page-2-clean.png"),
    },
    {
      pageNumber: 3,
      protection: { blur: false, watermark: true },
      file: previewFile("page-3.png"),
      previewUrl: "blob:3",
      source: previewFile("page-3-clean.png"),
    },
  ],
  protectionOptions: { blurStrength: 0, watermarkOpacity: 35, watermarkText: "ร้านเอ" },
};

const draftResponse: ProductDraftResponse = {
  draft: {
    name: "คู่มือสูตรขนมปัง",
    price: "290",
    comparePrice: "490",
    descriptionHtml: "<p>สูตรขนมปัง 30 สูตร</p>",
    highlights: ["30 สูตรพร้อมใช้"],
    faq: [{ id: "faq-1", question: "ไฟล์เป็นอะไร", answer: "PDF" }],
    imageAlt: "หน้าปกคู่มือ",
    notes: "ราคามาจากหน้าปก",
  },
  usage: {
    model: "deepseek-flash",
    promptTokens: 900,
    cachedTokens: 0,
    completionTokens: 300,
    costMicros: 630,
  },
  allowance: { limitMicros: 300_000, usedMicros: 630, remainingMicros: 299_370 },
  pagesRead: 2,
  textSource: "layer",
};

function setup(overrides: Partial<Parameters<typeof ProductPdfIntake>[0]> = {}) {
  const onApply = vi.fn();
  const onSkip = vi.fn();
  const requestDraft = vi.fn().mockResolvedValue(draftResponse);
  const uploadAsset = vi.fn(async ({ file }: UploadRequest) => ({
    path: `owner/${file.name}`,
    publicUrl: `https://cdn.test/${file.name}`,
  }));
  render(
    <ProductPdfIntake
      userId="owner"
      shopName="ร้านเอ"
      preferences={DEFAULT_PDF_PREVIEW_PREFERENCES}
      onApply={onApply}
      onSkip={onSkip}
      requestDraft={requestDraft}
      uploadAsset={uploadAsset}
      {...overrides}
    />,
  );
  return { onApply, onSkip, requestDraft, uploadAsset };
}

async function choosePdf(name = "guide.pdf") {
  await userEvent.upload(
    screen.getByLabelText("เลือกไฟล์ PDF ของสินค้า"),
    new File(["%PDF-1.7"], name, { type: "application/pdf" }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  pdf.extractPdf.mockResolvedValue(extraction);
});

describe("ProductPdfIntake", () => {
  it("reads the PDF, drafts from its text, and fills the form without asking again", async () => {
    const { onApply, requestDraft } = setup();
    await choosePdf();

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(requestDraft).toHaveBeenCalledWith({
      fileName: "guide.pdf",
      textSource: "layer",
      pages: [
        { pageNumber: 1, text: "หน้าหนึ่ง" },
        { pageNumber: 2, text: "หน้าสอง" },
      ],
    });
    expect(onApply.mock.calls[0][0].draft.name).toBe("คู่มือสูตรขนมปัง");
    expect(onApply.mock.calls[0][0].summary).toEqual({
      fileName: "guide.pdf",
      notes: "ราคามาจากหน้าปก",
      costMicros: 630,
      scanned: false,
      textPagesRead: 10,
    });
  });

  it("uploads the PDF and its preview images on the way to the form", async () => {
    const { onApply, uploadAsset } = setup();
    await choosePdf();

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    const result = onApply.mock.calls[0][0];
    expect(result.productFile).toEqual({
      path: "owner/guide.pdf",
      fileName: "guide.pdf",
      size: 8,
      mimeType: "application/pdf",
      // The whole document's length, not the three pages sampled from it.
      pageCount: 12,
    });
    expect(result.images).toHaveLength(3);
    // The first page carries the model's alt text; later pages say which page they are.
    expect(result.images[0].alt).toBe("หน้าปกคู่มือ");
    expect(result.images[1].alt).toBe("ตัวอย่างหน้า 2");
    expect(uploadAsset).toHaveBeenCalledTimes(4);
    expect(uploadAsset.mock.calls[0][0].destination).toBe("product-file");
    expect(uploadAsset.mock.calls[1][0].destination).toBe("product-image");
  });

  it("still offers the file and images when the agent is unavailable", async () => {
    const requestDraft = vi.fn().mockRejectedValue(new Error("ใช้โควตา AI ของเดือนนี้ครบแล้ว"));
    const { onApply } = setup({ requestDraft });
    await choosePdf();

    expect(await screen.findByText("ใช้โควตา AI ของเดือนนี้ครบแล้ว")).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "กรอกเองในฟอร์ม" }));
    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply.mock.calls[0][0].draft.name).toBe("");
    expect(onApply.mock.calls[0][0].images).toHaveLength(3);
    expect(onApply.mock.calls[0][0].summary.costMicros).toBeNull();
  });

  it("asks the agent again from the pages already read", async () => {
    // The model's reasoning shares a token budget with its answer, so the same
    // document can fail once and draft fine the next time. Re-reading the file
    // to find that out would cost the seller the whole upload again.
    const requestDraft = vi
      .fn()
      .mockRejectedValueOnce(new Error("AI ร่างข้อมูลไม่จบ กรุณาลองอีกครั้ง"))
      .mockResolvedValue(draftResponse);
    const { onApply } = setup({ requestDraft });
    await choosePdf();

    expect(await screen.findByText("AI ร่างข้อมูลไม่จบ กรุณาลองอีกครั้ง")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ให้ AI ลองอีกครั้ง" }));

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply.mock.calls[0][0].draft.name).toBe("คู่มือสูตรขนมปัง");
    expect(requestDraft).toHaveBeenCalledTimes(2);
    expect(requestDraft.mock.calls[1]).toEqual(requestDraft.mock.calls[0]);
    expect(pdf.extractPdf).toHaveBeenCalledOnce();
  });

  it("keeps the draft when the upload fails, and retries only the upload", async () => {
    const uploadAsset = vi
      .fn()
      .mockRejectedValueOnce(new Error("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง"))
      .mockImplementation(async ({ file }: UploadRequest) => ({
        path: `owner/${file.name}`,
        publicUrl: `https://cdn.test/${file.name}`,
      }));
    const { onApply, requestDraft } = setup({ uploadAsset });
    await choosePdf();

    expect(await screen.findByText("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ลองอัปโหลดอีกครั้ง" }));

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    // The agent is not asked a second time: its answer was never the problem.
    expect(requestDraft).toHaveBeenCalledOnce();
    expect(onApply.mock.calls[0][0].draft.name).toBe("คู่มือสูตรขนมปัง");
  });

  it("rejects a dropped file that is not a PDF without reading it", async () => {
    setup();
    // The file picker filters by `accept`; a drop is the path a ZIP can arrive on.
    fireEvent.drop(screen.getByLabelText("เลือกไฟล์ PDF ของสินค้า"), {
      dataTransfer: { files: [new File(["zip"], "bundle.zip", { type: "application/zip" })] },
    });
    expect(await screen.findByText("รองรับเฉพาะไฟล์ PDF")).toBeInTheDocument();
    expect(pdf.extractPdf).not.toHaveBeenCalled();
  });

  it("surfaces a PDF that cannot be read and returns to the dropzone", async () => {
    pdf.extractPdf.mockRejectedValue(new Error("อ่านไฟล์ PDF ไม่สำเร็จ กรุณาลองอีกครั้ง"));
    const { requestDraft } = setup();
    await choosePdf();
    expect(await screen.findByText("อ่านไฟล์ PDF ไม่สำเร็จ กรุณาลองอีกครั้ง")).toBeInTheDocument();
    expect(screen.getByLabelText("เลือกไฟล์ PDF ของสินค้า")).toBeInTheDocument();
    expect(requestDraft).not.toHaveBeenCalled();
  });

  it("skips the step without uploading anything", async () => {
    const { onSkip, uploadAsset } = setup();
    await userEvent.click(screen.getByRole("button", { name: "ข้าม แล้วกรอกข้อมูลเอง" }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("tells the agent, and the form, when the words came from a scan", async () => {
    pdf.extractPdf.mockResolvedValue({
      ...extraction,
      textSource: "ocr",
      textPagesRead: 3,
      pages: [{ pageNumber: 1, text: "คนทีเพิงเริมอบขนมปัง" }],
    });
    const { onApply, requestDraft } = setup();
    await choosePdf("scan.pdf");

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(requestDraft).toHaveBeenCalledWith({
      fileName: "scan.pdf",
      textSource: "ocr",
      pages: [{ pageNumber: 1, text: "คนทีเพิงเริมอบขนมปัง" }],
    });
    // Recognized text misreads words, and a wrong price is the costly misread.
    // The warning travels with the draft, because the fields are the form's now.
    expect(onApply.mock.calls[0][0].summary).toMatchObject({
      scanned: true,
      textPagesRead: 3,
    });
  });

  it("says nothing about scanning when the PDF had a text layer", async () => {
    const { onApply } = setup();
    await choosePdf();

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply.mock.calls[0][0].summary.scanned).toBe(false);
  });
});

describe("readingLabel", () => {
  it("counts OCR pages from one, so the first page is not reported as zero", () => {
    expect(readingLabel({ phase: "ocr", completed: 0, total: 3 })).toBe(
      "กำลังอ่านตัวอักษรจากรูป (OCR) หน้า 1/3",
    );
    expect(readingLabel({ phase: "ocr", completed: 2, total: 3 })).toBe(
      "กำลังอ่านตัวอักษรจากรูป (OCR) หน้า 3/3",
    );
  });

  it("does not run past the last page once the pass finishes", () => {
    expect(readingLabel({ phase: "ocr", completed: 3, total: 3 })).toBe(
      "กำลังอ่านตัวอักษรจากรูป (OCR) หน้า 3/3",
    );
  });

  it("names the other phases", () => {
    expect(readingLabel({ phase: "rendering", completed: 1, total: 3 })).toContain(
      "กำลังสร้างรูปตัวอย่าง 1/3",
    );
    expect(readingLabel({ phase: "reading", completed: 4, total: 10 })).toContain(
      "กำลังอ่านไฟล์ 4/10 หน้า",
    );
    expect(readingLabel(null)).toContain("กำลังอ่านไฟล์ 0/10 หน้า");
  });
});
