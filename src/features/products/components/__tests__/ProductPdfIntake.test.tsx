import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductPdfIntake } from "@/features/products/components/ProductPdfIntake";
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
  pages: [
    { pageNumber: 1, text: "หน้าหนึ่ง" },
    { pageNumber: 2, text: "หน้าสอง" },
  ],
  previews: [
    { pageNumber: 1, protected: false, file: previewFile("page-1.webp"), previewUrl: "blob:1" },
    { pageNumber: 2, protected: true, file: previewFile("page-2.webp"), previewUrl: "blob:2" },
    { pageNumber: 3, protected: true, file: previewFile("page-3.webp"), previewUrl: "blob:3" },
  ],
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
  it("reads the PDF, drafts from its text, and waits for a confirmation", async () => {
    const { onApply, requestDraft, uploadAsset } = setup();
    await choosePdf();

    expect(await screen.findByText("ตรวจข้อมูลที่ AI ร่างไว้")).toBeInTheDocument();
    expect(requestDraft).toHaveBeenCalledWith({
      fileName: "guide.pdf",
      pages: [
        { pageNumber: 1, text: "หน้าหนึ่ง" },
        { pageNumber: 2, text: "หน้าสอง" },
      ],
    });
    // Nothing is applied or uploaded while the seller is still reviewing.
    expect(onApply).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();

    expect(screen.getByText("คู่มือสูตรขนมปัง")).toBeInTheDocument();
    expect(screen.getByText("ราคามาจากหน้าปก")).toBeInTheDocument();
    expect(screen.getByText(/0.0006 USD/)).toBeInTheDocument();
    expect(screen.getByText(/12 หน้า/)).toBeInTheDocument();
  });

  it("uploads the PDF and its preview images once confirmed", async () => {
    const { onApply, uploadAsset } = setup();
    await choosePdf();
    await userEvent.click(await screen.findByRole("button", { name: "ยืนยันและกรอกลงฟอร์ม" }));

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    const result = onApply.mock.calls[0][0];
    expect(result.productFile).toEqual({
      path: "owner/guide.pdf",
      fileName: "guide.pdf",
      size: 8,
      mimeType: "application/pdf",
    });
    expect(result.images).toHaveLength(3);
    // The first page carries the model's alt text; later pages say which page they are.
    expect(result.images[0].alt).toBe("หน้าปกคู่มือ");
    expect(result.images[1].alt).toBe("ตัวอย่างหน้า 2");
    expect(uploadAsset).toHaveBeenCalledTimes(4);
    expect(uploadAsset.mock.calls[0][0].destination).toBe("product-file");
    expect(uploadAsset.mock.calls[1][0].destination).toBe("product-image");
  });

  it("applies only the fields left ticked", async () => {
    const { onApply, uploadAsset } = setup();
    await choosePdf();
    await userEvent.click(await screen.findByRole("checkbox", { name: /ราคา/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /รูปสินค้าจาก PDF/ }));
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันและกรอกลงฟอร์ม" }));

    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply.mock.calls[0][0].applied).toMatchObject({
      name: true,
      price: false,
      description: true,
      images: false,
    });
    // The product file is still uploaded; only the gallery images were declined.
    expect(onApply.mock.calls[0][0].images).toEqual([]);
    expect(uploadAsset).toHaveBeenCalledOnce();
  });

  it("marks which preview pages are protected", async () => {
    setup();
    await choosePdf();
    expect(await screen.findByText(/หน้า 1.*รูปหลัก/)).toBeInTheDocument();
    expect(screen.getByText(/หน้า 2.*ลายน้ำ \+ เบลอ/)).toBeInTheDocument();
  });

  it("still offers the file and images when the agent is unavailable", async () => {
    const requestDraft = vi.fn().mockRejectedValue(new Error("ใช้โควตา AI ของเดือนนี้ครบแล้ว"));
    const { onApply } = setup({ requestDraft });
    await choosePdf();

    expect(await screen.findByText("ใช้โควตา AI ของเดือนนี้ครบแล้ว")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันและกรอกลงฟอร์ม" }));
    await vi.waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply.mock.calls[0][0].draft.name).toBe("");
    expect(onApply.mock.calls[0][0].images).toHaveLength(3);
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

  it("lets the seller decline the draft after reviewing it", async () => {
    const { onSkip, onApply } = setup();
    await choosePdf();
    await userEvent.click(await screen.findByRole("button", { name: "ไม่ใช้ แล้วกรอกเอง" }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });
});
