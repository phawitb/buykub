import { beforeEach, expect, it, vi } from "vitest";
const {getUser,rpc,product,download}=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),product:vi.fn(),download:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser},rpc,storage:{from:()=>{throw new Error("Buyers must not touch storage");}}})}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:product})})}),storage:{from:()=>({download})}})}));
import { GET } from "./route";
const productId="12345678-1234-4123-8123-123456789abc";
const request=()=>GET(new Request("https://buykub.com"),{params:Promise.resolve({productId})});
beforeEach(()=>{
  vi.clearAllMocks();
  getUser.mockResolvedValue({data:{user:{id:"buyer",app_metadata:{provider:"google"}}}});
  rpc.mockResolvedValue({data:{allowed:true,reason:"active"},error:null});
  product.mockResolvedValue({data:{course_format:"exam_prep",shops:{owner_id:"owner"}},error:null});
  download.mockResolvedValue({data:new Blob(['{"format":"exam-prep"}']),error:null});
});
it("serves the pack from the owner's derived path, never cached",async()=>{
  const response=await request();
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('{"format":"exam-prep"}');
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(download).toHaveBeenCalledWith(`owner/exam-prep/${productId}/pack.json`);
});
it("requires a Google login",async()=>{
  getUser.mockResolvedValue({data:{user:{id:"x",app_metadata:{provider:"email"}}}});
  expect((await request()).status).toBe(401);
  expect(download).not.toHaveBeenCalled();
});
it.each(["not_purchased","expired","refunded"])("never downloads when access is %s",async reason=>{
  rpc.mockResolvedValue({data:{allowed:false,reason},error:null});
  expect((await request()).status).toBe(403);
  expect(product).not.toHaveBeenCalled();expect(download).not.toHaveBeenCalled();
});
it("fails closed when the entitlement lookup fails",async()=>{
  rpc.mockResolvedValue({data:null,error:{message:"offline"}});
  expect((await request()).status).toBe(503);
  expect(download).not.toHaveBeenCalled();
});
it("does not serve packs for lesson courses",async()=>{
  product.mockResolvedValue({data:{course_format:"lessons",shops:{owner_id:"owner"}},error:null});
  expect((await request()).status).toBe(404);
  expect(download).not.toHaveBeenCalled();
});
it("reports a missing upload as 404",async()=>{
  download.mockResolvedValue({data:null,error:{message:"Object not found"}});
  expect((await request()).status).toBe(404);
});
