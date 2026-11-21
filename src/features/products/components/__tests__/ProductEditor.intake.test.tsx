import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import type { PdfIntakeResult } from "@/features/products/components/ProductPdfIntake";
import type { ProductEditorValue } from "@/features/products/model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const upload = vi.hoisted(() => ({
  uploadShopAsset: vi.fn(async () => ({
    path: "owner/page-2-blurred.png",
    publicUrl: "https://cdn.test/2-blurred.png",
  })),
  deleteShopAsset: vi.fn(async () => undefined),
}));
vi.mock("@/lib/supabase/upload", () => upload);

const pdf = vi.hoisted(() => ({
  renderPreviewFile: vi.fn(async () => new File(["blurred"], "page-2.png", { type: "image/png" })),
  readPdfPageCount: vi.fn(async () => 42),
}));
vi.mock("@/features/products/pdf/extract", () => pdf);

const intake = vi.hoisted(() => ({ apply: null as ((result: PdfIntakeResult) => void) | null }));
vi.mock("@/features/products/components/ProductPdfIntake", () => ({
  ProductPdfIntake: ({
    onApply,
    onSkip,
  }: {
    onApply: (result: PdfIntakeResult) => void;
    onSkip: () => void;
  }) => {
    intake.apply = onApply;
    return (
      <div>
        <p>PDF step</p>
        <button type="button" onClick={onSkip}>
          ข้าม แล้วกรอกข้อมูลเอง
        </button>
      </div>
    );
  },
}));

const blank: ProductEditorValue = {
  deliveryType: "file",
  keyInput: "",
  keyInventory: { available: 0, assigned: 0, disabled: 0 },
  name: "",
  price: "",
  comparePrice: "",
  category: "OTHER",
  descriptionHtml: "",
  productFile: null,
  images: [],
  highlights: [],
  faq: [],
  published: true,
};

const result: PdfIntakeResult = {
  draft: {
    name: "คู่มือสูตรขนมปัง",
    price: "290",
    comparePrice: "490",
    descriptionHtml: "<p>สูตรขนมปัง 30 สูตร</p>",
    highlights: ["30 สูตรพร้อมใช้"],
    faq: [{ id: "faq-1", question: "ไฟล์เป็นอะไร", answer: "PDF" }],
    imageAlt: "หน้าปก",
    notes: "",
  },
  summary: {
    fileName: "guide.pdf",
    notes: "",
    costMicros: 630,
    scanned: false,
    textPagesRead: 10,
  },
  productFile: {
    path: "owner/guide.pdf",
    fileName: "guide.pdf",
    size: 2048,
    mimeType: "application/pdf",
  },
  images: [
    { id: "img-1", path: "owner/page-1.png", publicUrl: "https://cdn.test/1.png", alt: "หน้าปก" },
    {
      id: "img-2",
      path: "owner/page-2.png",
      publicUrl: "https://cdn.test/2.png",
      alt: "ตัวอย่างหน้า 2",
    },
  ],
  pages: [
    {
      imageId: "img-1",
      pageNumber: 1,
      protection: { blur: false, watermark: false },
      source: new File(["cover"], "page-1-clean.png", { type: "image/png" }),
    },
    {
      imageId: "img-2",
      pageNumber: 2,
      protection: { blur: false, watermark: true },
      source: new File(["page"], "page-2-clean.png", { type: "image/png" }),
    },
  ],
  protectionOptions: { blurStrength: 6, watermarkOpacity: 35, watermarkText: "ร้านเอ" },
};

function renderCreate(initialValue: ProductEditorValue = blank) {
  render(
    <ProductEditor
      mode="create"
      shopId="shop-1"
      userId="owner"
      shopName="ร้านเอ"
      existingSlugs={[]}
      initialValue={initialValue}
    />,
  );
}

beforeEach(() => {
  intake.apply = null;
  vi.clearAllMocks();
});

describe("ProductEditor PDF intake", () => {
  it("opens a blank new product on the PDF step", () => {
    renderCreate();
    expect(screen.getByText("PDF step")).toBeInTheDocument();
    expect(screen.queryByLabelText("ชื่อสินค้า *")).not.toBeInTheDocument();
  });

  it("goes straight to the form when the product already has content", () => {
    renderCreate({ ...blank, name: "มีชื่ออยู่แล้ว" });
    expect(screen.queryByText("PDF step")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("มีชื่ออยู่แล้ว")).toBeInTheDocument();
  });

  it("fills the form from the draft, with no confirmation step in between", async () => {
    renderCreate();
    intake.apply?.(result);

    expect(await screen.findByDisplayValue("คู่มือสูตรขนมปัง")).toBeInTheDocument();
    expect(screen.getByDisplayValue("290")).toBeInTheDocument();
    expect(screen.getByDisplayValue("490")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30 สูตรพร้อมใช้")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ไฟล์เป็นอะไร")).toBeInTheDocument();
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างสินค้า" })).toBeEnabled();
  });

  it("leaves a field the agent could not fill empty, rather than guessing", async () => {
    renderCreate();
    intake.apply?.({
      ...result,
      draft: { ...result.draft, price: "", comparePrice: "", faq: [] },
      images: [],
    });

    expect(await screen.findByDisplayValue("คู่มือสูตรขนมปัง")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("290")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("ไฟล์เป็นอะไร")).not.toBeInTheDocument();
    // The product file always arrives, so only the price stays unfilled, and
    // pressing the button is what tells the seller so.
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "สร้างสินค้า" }));
    expect(screen.getByText("กรุณากรอกราคาที่ถูกต้อง")).toBeInTheDocument();
  });

  it("says what it cost and what the agent flagged, above the filled fields", async () => {
    renderCreate();
    intake.apply?.({
      ...result,
      summary: { ...result.summary, notes: "เอกสารไม่ได้ระบุราคา" },
    });

    expect(await screen.findByText("AI กรอกข้อมูลจาก guide.pdf ให้แล้ว")).toBeInTheDocument();
    expect(screen.getByText(/0.0006 USD/)).toBeInTheDocument();
    expect(screen.getByText("เอกสารไม่ได้ระบุราคา")).toBeInTheDocument();
    expect(screen.queryByText(/น่าจะเป็นไฟล์สแกน/)).not.toBeInTheDocument();
  });

  it("warns in the form when the words were recognized from images", async () => {
    renderCreate();
    intake.apply?.({ ...result, summary: { ...result.summary, scanned: true } });

    expect(await screen.findByText(/น่าจะเป็นไฟล์สแกน/)).toBeInTheDocument();
    expect(screen.getByText(/กรุณาตรวจราคาและชื่อสินค้าให้ละเอียด/)).toBeInTheDocument();
  });

  it("lets the seller put the summary away", async () => {
    renderCreate();
    intake.apply?.(result);

    expect(await screen.findByText("AI กรอกข้อมูลจาก guide.pdf ให้แล้ว")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ปิด" }));
    expect(screen.queryByText("AI กรอกข้อมูลจาก guide.pdf ให้แล้ว")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("คู่มือสูตรขนมปัง")).toBeInTheDocument();
  });

  it("marks the price in red when the agent found none in the file", async () => {
    renderCreate();
    intake.apply?.({ ...result, draft: { ...result.draft, price: "", comparePrice: "" } });

    const price = await screen.findByLabelText(/ราคา \(บาท\)/);
    // A blank the seller has to notice before they publish: a free product is
    // the one mistake in this form that cannot be taken back after a sale.
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("AI หาราคาในไฟล์ไม่เจอ กรุณากรอกราคาเอง")).toBeInTheDocument();

    await userEvent.type(price, "290");
    expect(price).toHaveAttribute("aria-invalid", "false");
    expect(
      screen.queryByText("AI หาราคาในไฟล์ไม่เจอ กรุณากรอกราคาเอง"),
    ).not.toBeInTheDocument();
  });

  it("marks the price in red again when the seller clears the one AI found", async () => {
    renderCreate();
    intake.apply?.(result);

    const price = await screen.findByLabelText(/ราคา \(บาท\)/);
    expect(price).toHaveAttribute("aria-invalid", "false");

    await userEvent.clear(price);
    // Same blank, same risk, whoever emptied the field.
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("ยังไม่ได้กรอกราคา กรอกก่อนบันทึก")).toBeInTheDocument();
  });

  it("blurs one preview page on request, from the page as the PDF drew it", async () => {
    renderCreate();
    intake.apply?.(result);
    await screen.findByDisplayValue("คู่มือสูตรขนมปัง");

    const blur = screen.getByRole("button", { name: "เบลอหน้า 2" });
    expect(blur).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "ลายน้ำหน้า 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(blur);

    // Rebuilt from the clean render, so the watermark is drawn once, not twice.
    await waitFor(() =>
      expect(pdf.renderPreviewFile).toHaveBeenCalledWith(
        expect.objectContaining({ name: "page-2-clean.png" }),
        { blur: true, watermark: true },
        result.protectionOptions,
      ),
    );
    expect(await screen.findByAltText("ตัวอย่างหน้า 2")).toHaveAttribute(
      "src",
      "https://cdn.test/2-blurred.png",
    );
    expect(screen.getByRole("button", { name: "เบลอหน้า 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The page it replaced is dropped instead of being left in the bucket.
    expect(upload.deleteShopAsset).toHaveBeenCalledWith("product-image", "owner/page-2.png");
    expect(screen.getByAltText("หน้าปก")).toHaveAttribute("src", "https://cdn.test/1.png");
  });

  it("leaves the form blank when the step is skipped", async () => {
    renderCreate();
    await userEvent.click(screen.getByRole("button", { name: "ข้าม แล้วกรอกข้อมูลเอง" }));
    expect(screen.getByLabelText("ชื่อสินค้า *")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "สร้างสินค้า" }));
    expect(screen.getByText("กรุณากรอกชื่อสินค้า")).toBeInTheDocument();
  });
});
