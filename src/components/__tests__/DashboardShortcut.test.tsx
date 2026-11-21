import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getUser: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn(), listener: null as null | ((event: string, session: unknown) => void) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
import { DashboardShortcut } from "../DashboardShortcut";

beforeEach(() => {
  auth.getUser.mockReset();
  auth.onAuthStateChange.mockImplementation((fn) => { auth.listener = fn; return { data: { subscription: { unsubscribe: auth.unsubscribe } } }; });
});

it("shows nothing to visitors who are not signed in", async () => {
  auth.getUser.mockResolvedValue({ data: { user: null } });
  const { container } = render(<DashboardShortcut />);
  await act(async () => {});
  expect(container).toBeEmptyDOMElement();
});

it("links a signed-in visitor to their dashboard, and hides again on sign out", async () => {
  auth.getUser.mockResolvedValue({ data: { user: { id: "seller" } } });
  render(<DashboardShortcut />);
  expect(await screen.findByRole("link", { name: "แดชบอร์ด" })).toHaveAttribute("href", "/dashboard/products");
  act(() => auth.listener?.("SIGNED_OUT", null));
  await waitFor(() => expect(screen.queryByRole("link")).not.toBeInTheDocument());
});

it("does not appear while the account lookup is still pending", () => {
  auth.getUser.mockReturnValue(new Promise(() => {}));
  render(<DashboardShortcut />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
