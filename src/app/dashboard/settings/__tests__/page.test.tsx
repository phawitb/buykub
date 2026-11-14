import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import SettingsPage from "../page";

const mocks = vi.hoisted(() => ({ getSellerContext: vi.fn(), form: vi.fn() }));
vi.mock("@/lib/supabase/seller-context", () => ({ getSellerContext: mocks.getSellerContext }));
vi.mock("../SettingsForm", () => ({ SettingsForm: (props: unknown) => { mocks.form(props); return <div>Private payout form</div>; } }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
beforeEach(() => vi.clearAllMocks());

function fixture(data: object | null, error: Error | null = null) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  mocks.getSellerContext.mockResolvedValue({ supabase: { from }, user: { id: "owner" }, shop: { id: "shop" } });
  return { from, query };
}

it("loads payout identity only from the owned private profile", async () => {
  const { from, query } = fixture({ payout_method: "bank", national_id: "1101700207030" });
  render(await SettingsPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Private payout form")).toBeInTheDocument();
  expect(from).toHaveBeenCalledExactlyOnceWith("seller_payout_profiles");
  expect(query.eq).toHaveBeenCalledExactlyOnceWith("shop_id", "shop");
  expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({ initial: expect.objectContaining({ id: "shop", payout_method: "bank", national_id: "1101700207030" }) }));
});

it("allows the first profile to be created without falling back to public shop payout fields", async () => {
  const { from } = fixture(null);
  await SettingsPage({ searchParams: Promise.resolve({}) });
  expect(from).toHaveBeenCalledExactlyOnceWith("seller_payout_profiles");
});

it("does not render an empty form when the private profile query fails", async () => {
  fixture(null, new Error("Private profile unavailable"));
  await expect(SettingsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Private profile unavailable");
  expect(mocks.form).not.toHaveBeenCalled();
});
