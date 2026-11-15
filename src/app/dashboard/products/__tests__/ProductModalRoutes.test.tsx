import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import NewProductModal from "../@modal/(.)new/page";
import EditProductModal from "../@modal/(.)[id]/edit/page";
import NewProductPage from "../new/page";

const server = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/seller-context", () => ({ getSellerContext: server.context }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  notFound: () => { throw new Error("not-found"); },
}));
vi.mock("@/features/products/components/RichTextEditor", () => ({ RichTextEditor: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  server.context.mockResolvedValue({ supabase: { from: server.from }, user: { id: "owner" }, shop: { id: "owned-shop" } });
});

it("checks seller access before rendering the create dialog", async () => {
  server.context.mockResolvedValue({ supabase: { from: server.from }, user: { id: "buyer" }, shop: null });
  await expect(NewProductModal()).rejects.toThrow("redirect:/dashboard/products?create=1");
  expect(server.from).not.toHaveBeenCalled();
});

it("renders the same editor in a modal while the direct create URL stays standalone", async () => {
  // Slug list resolves from `.eq()`; PDF preferences continue to `.maybeSingle()`.
  server.from.mockReturnValue({
    select: () => {
      const result = Promise.resolve({ data: [], error: null });
      return { eq: () => Object.assign(result, { maybeSingle: async () => ({ data: null, error: null }) }) };
    },
  });
  const modal = render(await NewProductModal());
  expect(screen.getByRole("dialog", { name: "สร้างสินค้าใหม่" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "เริ่มจากไฟล์ PDF" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "ข้าม แล้วกรอกข้อมูลเอง" }));
  expect(screen.getByLabelText("ชื่อสินค้า *")).toBeInTheDocument();
  modal.unmount();
  render(await NewProductPage());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "ข้าม แล้วกรอกข้อมูลเอง" }));
  expect(screen.getByLabelText("ชื่อสินค้า *")).toBeInTheDocument();
});

it("rejects a product outside the current owner's shop before rendering a modal", async () => {
  const query = { select: vi.fn(), eq: server.eq, neq: async () => ({ data: [] }), order: async () => ({ data: [] }), maybeSingle: async () => ({ data: null }) };
  query.select.mockReturnValue(query);
  server.eq.mockReturnValue(query);
  server.from.mockReturnValue(query);
  await expect(EditProductModal({ params: Promise.resolve({ id: "someone-elses-product" }) })).rejects.toThrow("not-found");
  expect(server.eq).toHaveBeenCalledWith("id", "someone-elses-product");
  expect(server.eq).toHaveBeenCalledWith("shop_id", "owned-shop");
});
