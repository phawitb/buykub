import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductEditor } from "@/features/products/components/ProductEditor";
import type { PdfIntakeResult } from "@/features/products/components/ProductPdfIntake";
import type { ProductEditorValue } from "@/features/products/model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

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
  applied: {
    name: true,
    price: true,
    description: true,
    highlights: true,
    faq: true,
    images: true,
  },
  productFile: {
    path: "owner/guide.pdf",
    fileName: "guide.pdf",
    size: 2048,
    mimeType: "application/pdf",
  },
  images: [
    { id: "img-1", path: "owner/page-1.webp", publicUrl: "https://cdn.test/1.webp", alt: "หน้าปก" },
  ],
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

  it("fills the form from a confirmed draft", async () => {
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

  it("writes only the fields the seller kept ticked", async () => {
    renderCreate();
    intake.apply?.({
      ...result,
      applied: { ...result.applied, price: false, faq: false, images: false },
      images: [],
    });

    expect(await screen.findByDisplayValue("คู่มือสูตรขนมปัง")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("290")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("ไฟล์เป็นอะไร")).not.toBeInTheDocument();
    // The product file always arrives, so only the price stays unfilled.
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างสินค้า" })).toBeDisabled();
  });

  it("leaves the form blank when the step is skipped", async () => {
    renderCreate();
    await userEvent.click(screen.getByRole("button", { name: "ข้าม แล้วกรอกข้อมูลเอง" }));
    expect(screen.getByLabelText("ชื่อสินค้า *")).toHaveValue("");
    expect(screen.getByRole("button", { name: "สร้างสินค้า" })).toBeDisabled();
  });
});
