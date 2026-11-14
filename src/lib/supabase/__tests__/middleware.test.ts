import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "../middleware";

const { createServerClient, getClaims } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

describe("BUYKUB route access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerClient.mockReturnValue({ auth: { getClaims } });
  });

  it("keeps the public landing accessible to a signed-in Google visitor", async () => {
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([{ name: "session", value: "refreshed", options: { path: "/", httpOnly: true } }]);
      return { auth: { getClaims } };
    });
    getClaims.mockResolvedValue({ data: { claims: { sub: "seller", app_metadata: { provider: "google" } } }, error: null });
    const result = await updateSession(new NextRequest("https://buykub.com/?campaign=test"));
    expect(result.headers.get("location")).toBeNull();
    expect(result.headers.get("x-middleware-next")).toBe("1");
    expect(result.cookies.get("session")?.value).toBe("refreshed");
  });

  it("keeps the public homepage accessible without a verified Google session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });
    const result = await updateSession(new NextRequest("https://buykub.com/"));
    expect(result.headers.get("location")).toBeNull();
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/dashboard", "/learn/course-1"])("rejects email-only sessions at %s without trusting editable metadata", async (path) => {
    getClaims.mockResolvedValue({ data: { claims: {
      sub: "email-user", app_metadata: { provider: "email" },
      user_metadata: { provider: "google" }, identities: [{ provider: "email" }],
    } } });
    const result = await updateSession(new NextRequest(`https://buykub.com${path}?lesson=2`));
    const redirect = new URL(result.headers.get("location")!);
    expect(redirect.pathname).toBe("/login");
    expect(redirect.searchParams.get("reason")).toBe("google_required");
    expect(redirect.searchParams.get("next")).toBe(`${path}?lesson=2`);
  });

  it("accepts an existing email account with a verified Google identity", async () => {
    getClaims.mockResolvedValue({ data: { claims: {
      sub: "linked-user", app_metadata: { provider: "email", providers: ["email", "google"] },
      identities: [{ provider: "google" }],
    } } });
    const result = await updateSession(new NextRequest("https://buykub.com/dashboard"));
    expect(result.headers.get("location")).toBeNull();
    expect(result.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/dashboard/bookings", "/dashboard/bookings/new", "/dashboard/bookings/service-1/edit"])("pauses %s before the booking page can run", async (path) => {
    const result = await updateSession(new NextRequest(`https://buykub.com${path}`));
    expect(result.headers.get("location")).toBe("https://buykub.com/dashboard/products");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("preserves refreshed cookies when redirecting a rejected session", async () => {
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([{ name: "session", value: "refreshed", options: { path: "/", httpOnly: true } }]);
      return { auth: { getClaims } };
    });
    getClaims.mockResolvedValue({ data: { claims: null } });
    const result = await updateSession(new NextRequest("https://buykub.com/dashboard"));
    expect(result.cookies.get("session")?.value).toBe("refreshed");
  });
});

it("fails closed when claims verification reports an error", async () => {
 createServerClient.mockReturnValue({auth:{getClaims:async()=>({data:{claims:{sub:"fake",app_metadata:{provider:"google"}}},error:new Error("bad signature")})}});
 const result=await updateSession(new NextRequest("https://buykub.com/learn/course"));
 expect(new URL(result.headers.get("location")!).pathname).toBe("/login");
});
it("rejects a signed payload without a subject", async () => {
 createServerClient.mockReturnValue({auth:{getClaims:async()=>({data:{claims:{app_metadata:{provider:"google"}}},error:null})}});
 const result=await updateSession(new NextRequest("https://buykub.com/dashboard"));
 expect(new URL(result.headers.get("location")!).pathname).toBe("/login");
});
