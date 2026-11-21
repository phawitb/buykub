import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyShop } from "./MyShop";

const database = vi.hoisted(() => {
  const query = { update: vi.fn(), insert: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
  return { query, from: vi.fn() };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: database.from }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/storefront/invalidate", () => ({ invalidatePublicCatalog: vi.fn(async () => true), CATALOG_REFRESH_WARNING: "Refresh delayed" }));
const shop = { id: "shop-1", slug: "my-shop", name: "My shop", bio: "Welcome", avatar_url: null, cover_url: null, accent_color: "#f97316" };
const products = [true, false].map((published, i) => ({ id: `product-${i}`, shop_id: "shop-1", name: published ? "Public guide" : "Private draft", slug: `guide-${i}`, description: "", price_cents: 10000, compare_price_cents: null, category: "Guide", published, delivery_type: "file", thumbnailUrl: null, assets: [] }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  sessionStorage.clear();
  vi.clearAllMocks();
  database.from.mockReturnValue(database.query);
  for (const method of [database.query.update, database.query.insert, database.query.eq, database.query.select]) method.mockReturnValue(database.query);
  database.query.single.mockResolvedValue({ data: { id: "shop-1" }, error: null });
});

it("starts with owner editing and excludes drafts and management from customer preview", async () => {
  const user = userEvent.setup();
  render(<MyShop userId="user-1" initial={shop} products={products} />);
  expect(screen.getByRole("button", { name: "จัดการร้าน" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("link", { name: /เพิ่มสินค้า/ })).toBeInTheDocument();
  expect(screen.getByText("Private draft")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "มุมมองลูกค้า" }));
  const storefront = screen.getByRole("region", { name: "หน้าร้าน" });
  expect(within(storefront).getByText("Public guide")).toBeInTheDocument();
  expect(within(storefront).queryByText("Private draft")).not.toBeInTheDocument();
  expect(within(storefront).queryByRole("button", { name: "ลบสินค้า" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /เพิ่มสินค้า/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "ชื่อร้าน" })).not.toBeInTheDocument();
});

it("saves appearance fields without sending payout fields", async () => {
  const user = userEvent.setup();
  const saveAppearance = vi.fn<(payload: unknown) => Promise<{ id: string }>>().mockResolvedValue({ id: "shop-1" });
  render(<MyShop userId="user-1" initial={shop} products={[]} saveAppearance={saveAppearance} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await user.clear(screen.getByRole("textbox", { name: "ชื่อร้าน" }));
  await user.type(screen.getByRole("textbox", { name: "ชื่อร้าน" }), "New name");
  await user.click(screen.getByRole("button", { name: "บันทึกหน้าร้าน" }));
  await waitFor(() => expect(saveAppearance).toHaveBeenCalledOnce());
  expect(saveAppearance.mock.calls[0]).toEqual([{ slug: "my-shop", name: "New name", bio: "Welcome", avatar_url: null, cover_url: null, accent_color: "#f97316" }]);
});

it("creates a new shop from name and link without payout details", async () => {
  const user = userEvent.setup();
  const saveAppearance = vi.fn<(payload: unknown) => Promise<{ id: string }>>().mockResolvedValue({ id: "new-shop" });
  render(<MyShop userId="user-1" initial={null} products={[]} saveAppearance={saveAppearance} />);
  await user.type(screen.getByRole("textbox", { name: "ชื่อร้าน" }), "My new shop");
  await user.type(screen.getByRole("textbox", { name: "URL ร้าน" }), "new-shop");
  await user.click(screen.getByRole("button", { name: "สร้างร้าน" }));
  await waitFor(() => expect(saveAppearance).toHaveBeenCalledOnce());
  expect(saveAppearance.mock.calls[0][0]).not.toHaveProperty("payout_method");
  expect(screen.getByRole("link", { name: /เพิ่มสินค้า/ })).toBeInTheDocument();
});

it("scopes appearance updates to the owner's shop and keeps payout untouched", async () => {
  const user = userEvent.setup();
  render(<MyShop userId="user-1" initial={shop} products={[]} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await user.click(screen.getByRole("button", { name: "บันทึกหน้าร้าน" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("บันทึกหน้าร้านสำเร็จ"));
  expect(database.query.update.mock.calls[0][0]).toEqual({ slug: "my-shop", name: "My shop", bio: "Welcome", avatar_url: null, cover_url: null, accent_color: "#f97316" });
  expect(database.query.eq.mock.calls).toEqual([["id", "shop-1"], ["owner_id", "user-1"]]);
});

it("does not report success when an update finds no owned shop", async () => {
  const user = userEvent.setup();
  database.query.single.mockResolvedValue({ data: null, error: { message: "No owned shop found" } });
  render(<MyShop userId="user-1" initial={shop} products={[]} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await user.click(screen.getByRole("button", { name: "บันทึกหน้าร้าน" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No owned shop found"));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveValue("My shop");
});

it("keeps edits across mode changes and restores the appearance draft after remount", async () => {
  const user = userEvent.setup();
  const first = render(<MyShop userId="user-1" initial={shop} products={[]} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await user.clear(screen.getByRole("textbox", { name: "ชื่อร้าน" }));
  await user.type(screen.getByRole("textbox", { name: "ชื่อร้าน" }), "Unsaved shop");
  await user.click(screen.getByRole("button", { name: "ปิดตัวแก้ไข" }));
  await user.click(screen.getByRole("button", { name: "มุมมองลูกค้า" }));
  expect(screen.getByRole("heading", { name: "Unsaved shop" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "จัดการร้าน" }));
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveValue("Unsaved shop");
  first.unmount();
  render(<MyShop userId="user-1" initial={shop} products={[]} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveValue("Unsaved shop"));
  expect(screen.queryByLabelText("ค่าสี accent")).not.toBeInTheDocument();
});

it("identifies an unpublished shop when previewing the customer view", async () => {
  const user = userEvent.setup();
  render(<MyShop userId="user-1" initial={{ ...shop, published: false }} products={products} />);
  await user.click(screen.getByRole("button", { name: "มุมมองลูกค้า" }));
  expect(screen.getByText(/ร้านยังไม่เผยแพร่/)).toBeInTheDocument();
});

it.each(["dashboard", "learn", "login", "auth", "api", "checkout", "privacy", "terms"])("rejects reserved shop URL %s before saving", async (slug) => {
  const user = userEvent.setup();
  const saveAppearance = vi.fn<(payload: unknown) => Promise<{ id: string }>>().mockResolvedValue({ id: "new-shop" });
  render(<MyShop userId="user-1" initial={null} products={[]} desiredSlug={slug} saveAppearance={saveAppearance} />);
  await user.type(screen.getByRole("textbox", { name: "ชื่อร้าน" }), "My shop");
  await user.click(screen.getByRole("button", { name: "สร้างร้าน" }));
  expect(screen.getByRole("alert")).toHaveTextContent("URL นี้สงวนไว้สำหรับระบบ");
  expect(saveAppearance).not.toHaveBeenCalled();
});

it("shares the saved shop URL and previews edits without linking to an unsaved slug", async () => {
  const user = userEvent.setup();
  render(<MyShop userId="user-1" initial={shop} products={products} />);
  expect(screen.getByRole("link", { name: "เปิดหน้าร้านจริง" })).toHaveAttribute("href", "https://buykub.com/my-shop");
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await user.clear(screen.getByRole("textbox", { name: "URL ร้าน" }));
  await user.type(screen.getByRole("textbox", { name: "URL ร้าน" }), "not-saved");
  await user.click(screen.getByRole("button", { name: "ปิดตัวแก้ไข" }));
  await user.click(screen.getByRole("button", { name: "มุมมองลูกค้า" }));
  expect(screen.getByText(/มีการแก้ไขที่ยังไม่ได้บันทึก/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "แชร์ร้าน" }));
  expect(await navigator.clipboard.readText()).toBe("https://buykub.com/my-shop");
  expect(screen.getByRole("link", { name: "buykub.com/my-shop" })).toHaveAttribute("href", "https://buykub.com/my-shop");
  expect(screen.getByRole("link", { name: "Public guide" })).toHaveAttribute("href", "/my-shop/guide-0");
});


it("opens a modal over the storefront and restores focus and drafts when dismissed", async () => {
  const user = userEvent.setup();
  render(<MyShop userId="user-1" initial={shop} products={products} />);
  const edit = screen.getByRole("button", { name: "แก้ไขชื่อร้าน" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(edit);
  const dialog = screen.getByRole("dialog", { name: "แก้ไขชื่อร้าน" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  await user.clear(screen.getByRole("textbox", { name: "ชื่อร้าน" }));
  await user.type(screen.getByRole("textbox", { name: "ชื่อร้าน" }), "Draft title");
  fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(edit).toHaveFocus();
  expect(screen.getByRole("heading", { name: "Draft title" })).toBeInTheDocument();
  await user.click(edit);
  expect(screen.getByRole("textbox", { name: "ชื่อร้าน" })).toHaveValue("Draft title");
  fireEvent.click(screen.getByRole("dialog"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps the saved shop link and share action beside the view controls in both modes", async () => {
  const user = userEvent.setup();
  render(<MyShop userId="user-1" initial={shop} products={products} />);
  const controls = screen.getByRole("group", { name: "เครื่องมือหน้าร้าน" });
  expect(within(controls).getByRole("link", { name: "เปิดหน้าร้านจริง" })).toHaveAttribute("href", "https://buykub.com/my-shop");
  await user.click(within(controls).getByRole("button", { name: "แชร์ร้าน" }));
  expect(await navigator.clipboard.readText()).toBe("https://buykub.com/my-shop");
  expect(within(controls).getByRole("status")).toHaveTextContent("คัดลอกลิงก์แล้ว");
  await user.click(within(controls).getByRole("button", { name: "มุมมองลูกค้า" }));
  expect(within(controls).getByRole("link", { name: "เปิดหน้าร้านจริง" })).toHaveAttribute("href", "https://buykub.com/my-shop");
});

it("lets the seller shuffle a stored nature cover and save it", async () => {
  const user = userEvent.setup();
  const saveAppearance = vi.fn(async () => ({ id: "shop-1" }));
  render(<MyShop userId="user-1" initial={shop} products={[]} saveAppearance={saveAppearance} />);
  await user.click(screen.getByRole("button", { name: "เปลี่ยนรูปปก" }));
  await user.click(screen.getByRole("button", { name: "สุ่มภาพปกธรรมชาติ" }));
  await user.click(screen.getByRole("button", { name: "บันทึกหน้าร้าน" }));
  await waitFor(() => expect(saveAppearance).toHaveBeenCalledWith(expect.objectContaining({ cover_url: expect.stringMatching(/^\/images\/shop-covers\/nature-\d\d\.webp$/) })));
});


it.each([
  ["เปลี่ยนรูปโปรไฟล์", "เลือกรูปโปรไฟล์", "เลือกรูปปก"],
  ["เปลี่ยนรูปปก", "เลือกรูปปก", "เลือกรูปโปรไฟล์"],
  ["แก้ไขชื่อร้าน", "ชื่อร้าน", "แนะนำร้าน"],
  ["แก้ไขคำแนะนำร้าน", "แนะนำร้าน", "ชื่อร้าน"],
])("opens only the clicked storefront section: %s", async (trigger, field, excluded) => {
  const user = userEvent.setup();
  render(<MyShop userId="user-1" initial={shop} products={[]} />);
  const button = screen.getByRole("button", { name: trigger });
  await user.click(button);
  const dialog = screen.getByRole("dialog", { name: trigger });
  expect(within(dialog).getByLabelText(field)).toBeInTheDocument();
  expect(within(dialog).queryByLabelText(excluded)).not.toBeInTheDocument();
  expect(within(dialog).queryByLabelText("ค่าสี accent")).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "ปิดตัวแก้ไข" }));
  expect(button).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "มุมมองลูกค้า" }));
  expect(screen.queryByRole("button", { name: trigger })).not.toBeInTheDocument();
});

it("allows adding an empty bio from the storefront and saving only its intended change", async () => {
  const user = userEvent.setup();
  const saveAppearance = vi.fn(async () => ({ id: "shop-1" }));
  render(<MyShop userId="user-1" initial={{ ...shop, bio: null }} products={[]} saveAppearance={saveAppearance} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขคำแนะนำร้าน" }));
  await user.type(screen.getByLabelText("แนะนำร้าน"), "Notes and courses");
  await user.click(screen.getByRole("button", { name: "บันทึกหน้าร้าน" }));
  await waitFor(() => expect(saveAppearance).toHaveBeenCalledWith({ slug: shop.slug, name: shop.name, bio: "Notes and courses", avatar_url: null, cover_url: null, accent_color: shop.accent_color }));
  expect(screen.getByRole("link", { name: "เพิ่มสินค้า" })).toHaveTextContent("เพิ่มสินค้า");
});

it("saves one section without publishing or discarding an unfinished change in another", async () => {
  const user = userEvent.setup();
  const saveAppearance = vi.fn(async () => ({ id: "shop-1" }));
  render(<MyShop userId="user-1" initial={shop} products={[]} saveAppearance={saveAppearance} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await user.clear(screen.getByLabelText("ชื่อร้าน"));
  await user.click(screen.getByRole("button", { name: "ปิดตัวแก้ไข" }));
  await user.click(screen.getByRole("button", { name: "แก้ไขคำแนะนำร้าน" }));
  await user.clear(screen.getByLabelText("แนะนำร้าน"));
  await user.type(screen.getByLabelText("แนะนำร้าน"), "Updated bio");
  await user.click(screen.getByRole("button", { name: "บันทึกหน้าร้าน" }));
  await waitFor(() => expect(saveAppearance).toHaveBeenCalledWith(expect.objectContaining({ name: shop.name, bio: "Updated bio" })));
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  expect(screen.getByLabelText("ชื่อร้าน")).toHaveValue("");
});

it("retains a pending title across remount after saving an unchanged bio", async () => {
  const user = userEvent.setup();
  const saveAppearance = vi.fn(async () => ({ id: "shop-1" }));
  const mounted = render(<MyShop userId="user-1" initial={shop} products={[]} saveAppearance={saveAppearance} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await user.clear(screen.getByLabelText("ชื่อร้าน"));
  await user.type(screen.getByLabelText("ชื่อร้าน"), "Pending title");
  await user.click(screen.getByRole("button", { name: "ปิดตัวแก้ไข" }));
  await user.click(screen.getByRole("button", { name: "แก้ไขคำแนะนำร้าน" }));
  await user.click(screen.getByRole("button", { name: "บันทึกหน้าร้าน" }));
  await waitFor(() => expect(saveAppearance).toHaveBeenCalled());
  mounted.unmount();
  render(<MyShop userId="user-1" initial={shop} products={[]} saveAppearance={saveAppearance} />);
  await user.click(screen.getByRole("button", { name: "แก้ไขชื่อร้าน" }));
  await waitFor(() => expect(screen.getByLabelText("ชื่อร้าน")).toHaveValue("Pending title"));
});

describe("arranging products", () => {
  const three = ["A", "B", "C"].map((name, i) => ({ ...products[0], id: `p-${name}`, name: `Guide ${name}`, slug: `guide-${name}`, published: i !== 1 }));
  // jsdom lays nothing out; give each card a place in one row so dnd-kit can find neighbours.
  let rectSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const item = this.closest('[role="listitem"]');
      const index = item ? Array.from(item.parentElement!.children).indexOf(item) : 0;
      const left = index * 200;
      return { x: left, y: 0, left, top: 0, right: left + 180, bottom: 300, width: 180, height: 300, toJSON: () => ({}) } as DOMRect;
    });
  });
  afterEach(() => rectSpy.mockRestore());
  const names = () => within(screen.getByRole("region", { name: "หน้าร้าน" })).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

  async function moveFirstRight(user: ReturnType<typeof userEvent.setup>) {
    screen.getByRole("button", { name: "ย้ายตำแหน่ง Guide A" }).focus();
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowRight]");
    await user.keyboard("[Space]");
  }

  it("saves the whole new order, drafts included, and shows it in the customer preview", async () => {
    const user = userEvent.setup();
    const saveProductOrder = vi.fn<(ids: string[]) => Promise<void>>().mockResolvedValue(undefined);
    render(<MyShop userId="user-1" initial={shop} products={three} saveProductOrder={saveProductOrder} />);
    expect(screen.getByText("กดค้างที่สินค้าแล้วลากเพื่อเรียงลำดับบนหน้าร้าน")).toBeInTheDocument();
    await moveFirstRight(user);
    await waitFor(() => expect(saveProductOrder).toHaveBeenCalledOnce());
    expect(saveProductOrder).toHaveBeenCalledWith(["p-B", "p-A", "p-C"]);
    expect(names()).toEqual(["Guide B", "Guide A", "Guide C"]);
    await user.click(screen.getByRole("button", { name: "มุมมองลูกค้า" }));
    expect(names()).toEqual(["Guide A", "Guide C"]);
    expect(screen.queryByRole("button", { name: /ย้ายตำแหน่ง/ })).not.toBeInTheDocument();
  });

  it("puts the products back and explains when the order cannot be saved", async () => {
    const user = userEvent.setup();
    const saveProductOrder = vi.fn<(ids: string[]) => Promise<void>>().mockRejectedValue({ message: "offline" });
    render(<MyShop userId="user-1" initial={shop} products={three} saveProductOrder={saveProductOrder} />);
    await moveFirstRight(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("บันทึกลำดับสินค้าไม่สำเร็จ: offline");
    expect(names()).toEqual(["Guide A", "Guide B", "Guide C"]);
  });

  it("offers no arranging for a single product", () => {
    render(<MyShop userId="user-1" initial={shop} products={[three[0]]} />);
    expect(screen.queryByRole("button", { name: /ย้ายตำแหน่ง/ })).not.toBeInTheDocument();
  });
});
