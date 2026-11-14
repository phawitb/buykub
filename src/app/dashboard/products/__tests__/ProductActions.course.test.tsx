import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ProductActions } from "../ProductActions";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/client", () => ({createClient: () => ({from: () => ({update: () => ({eq: () => ({eq: async () => ({error:{message:"course_not_ready"}})})})})})}));
it("explains an empty course publishing rejection and links to curriculum", async () => {
  render(<ProductActions productId="course-1" shopId="shop" productName="Course" published={false} assets={[]}/>);
  await userEvent.click(screen.getByRole("button", {name:"เผยแพร่สินค้า"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("เพิ่มบทเรียนที่เผยแพร่อย่างน้อย 1 บทก่อนเปิดขายคอร์ส");
  expect(screen.getByRole("link", {name:"จัดการบทเรียน"})).toHaveAttribute("href", "/dashboard/products/course-1/lessons");
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole("button", {name:"เผยแพร่สินค้า"})).toBeEnabled();
});

vi.mock("@/lib/storefront/invalidate", () => ({ invalidatePublicCatalog: vi.fn(async () => true), CATALOG_REFRESH_WARNING: "Refresh delayed" }));
