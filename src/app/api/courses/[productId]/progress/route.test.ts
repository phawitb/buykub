import { beforeEach, expect, it, vi } from "vitest";
const {getUser,rpc,maybeSingle,eq}=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),maybeSingle:vi.fn(),eq:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser},rpc,from:()=>({select:()=>({eq:(...args:unknown[])=>{eq(...args);return {maybeSingle};}})})})}));
import { GET, PUT } from "./route";
const productId="12345678-1234-4123-8123-123456789abc";
const ctx=(id=productId)=>({params:Promise.resolve({productId:id})});
const put=(body:unknown,id=productId)=>PUT(new Request("https://buykub.com/api",{method:"PUT",body:typeof body==="string"?body:JSON.stringify(body)}),ctx(id));
const access=(data:unknown)=>rpc.mockImplementation(async(name:string,args:unknown)=>name==="course_access"?{data,error:null}:saveResult(args));
let saveResult:(args:unknown)=>unknown;
beforeEach(()=>{
  vi.clearAllMocks();
  getUser.mockResolvedValue({data:{user:{id:"buyer",app_metadata:{provider:"google"}}}});
  saveResult=()=>({data:{conflict:false,updated_at:"2026-11-21T10:00:00Z"},error:null});
  access({allowed:true,reason:"active"});
  maybeSingle.mockResolvedValue({data:{state:{att:{}},updated_at:"2026-11-21T09:00:00Z"},error:null});
});
it("requires a Google login",async()=>{
  getUser.mockResolvedValue({data:{user:null}});
  expect((await GET(new Request("https://buykub.com"),ctx())).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects malformed product ids before any lookup",async()=>{
  expect((await put({state:{}},"../x")).status).toBe(404);
  expect(getUser).not.toHaveBeenCalled();
});
it.each(["not_purchased","expired","refunded"])("denies reads and writes when access is %s",async reason=>{
  access({allowed:false,reason});
  expect((await GET(new Request("https://buykub.com"),ctx())).status).toBe(403);
  expect((await put({state:{a:1}})).status).toBe(403);
  expect(maybeSingle).not.toHaveBeenCalled();
  expect(rpc.mock.calls.map(c=>c[0])).not.toContain("save_course_progress");
});
it("returns the caller's progress privately",async()=>{
  const response=await GET(new Request("https://buykub.com"),ctx());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({state:{att:{}},updated_at:"2026-11-21T09:00:00Z"});
  expect(eq).toHaveBeenCalledWith("product_id",productId);
});
it("saves through the RPC with the client's base version",async()=>{
  const response=await put({state:{att:{q1:1}},base:"2026-11-21T09:00:00Z"});
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({updated_at:"2026-11-21T10:00:00Z"});
  expect(rpc).toHaveBeenCalledWith("save_course_progress",{p_product_id:productId,p_state:{att:{q1:1}},p_base:"2026-11-21T09:00:00Z"});
});
it("hands back the stored copy on a conflict",async()=>{
  saveResult=()=>({data:{conflict:true,state:{att:{q2:1}},updated_at:"2026-11-21T11:00:00Z"},error:null});
  const response=await put({state:{att:{}},base:null});
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({state:{att:{q2:1}},updated_at:"2026-11-21T11:00:00Z"});
});
it("refuses oversized and malformed bodies without calling the database",async()=>{
  expect((await put(JSON.stringify({state:{x:"a".repeat(700*1024)}}))).status).toBe(413);
  expect((await put("{nope")).status).toBe(400);
  expect((await put({state:[1]})).status).toBe(400);
  expect((await put({state:{},base:5})).status).toBe(400);
  expect(rpc.mock.calls.map(c=>c[0])).not.toContain("save_course_progress");
});
it("maps database refusals",async()=>{
  saveResult=()=>({data:null,error:{message:"invalid_progress"}});
  expect((await put({state:{}})).status).toBe(413);
  saveResult=()=>({data:null,error:{message:"course_access_denied"}});
  expect((await put({state:{}})).status).toBe(403);
});
