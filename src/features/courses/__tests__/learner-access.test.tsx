import {beforeEach,describe,expect,it,vi} from "vitest";
import LearnCoursePage from "@/app/learn/[productId]/page";
const {rpc,from,getUser}=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),getUser:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`REDIRECT:${url}`);}}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc,from,auth:{getUser}})}));
vi.mock("../CourseReader",()=>({CourseReader:()=>null}));
beforeEach(()=>{vi.clearAllMocks();getUser.mockResolvedValue({data:{user:{id:"buyer",app_metadata:{provider:"google"}}}});});
describe("learner authorization boundary",()=>{
  it("sanitizes authorized materials on the server and strips document targets from client props",async()=>{
    rpc.mockImplementation(async(name:string)=>name === "course_access" ? {data:{allowed:true,reason:"active",expires_at:null},error:null} : {data:[],error:null});
    from.mockImplementation((table:string)=>{
      const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{name:"Course"}}),order:async()=>({data:table === "course_lessons" ? [{id:"lesson",title:"Lesson",content_html:'<p>Safe</p><iframe src="https://evil.test"></iframe>',youtube_url:"https://youtu.be/dQw4w9WgXcQ",documents:[{id:"doc",name:"Private PDF",path:"owner/private.pdf"},{id:"external",name:"Notes",url:"https://docs.example.com/secret"}]}] : [],error:null})};return query;
    });
    const result=await LearnCoursePage({params:Promise.resolve({productId:"product"})});
    const lesson=result.props.lessons[0];
    expect(lesson.content_html).toBe("<p>Safe</p>");
    expect(lesson.youtube_url).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(lesson.documents).toEqual([{id:"doc",name:"Private PDF"},{id:"external",name:"Notes"}]);
  });

  it("redirects anonymous visitors before any material query",async()=>{
    getUser.mockResolvedValue({data:{user:null}});
    await expect(LearnCoursePage({params:Promise.resolve({productId:"product"})})).rejects.toThrow("REDIRECT:/login");
    expect(from).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects non-Google accounts",async()=>{
    getUser.mockResolvedValue({data:{user:{id:"buyer",app_metadata:{provider:"email"}}}});
    await expect(LearnCoursePage({params:Promise.resolve({productId:"product"})})).rejects.toThrow("REDIRECT:/login");
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["not_purchased","expired","refunded"])("does not fetch any content for %s",async reason=>{
    rpc.mockResolvedValue({data:{allowed:false,reason,expires_at:null},error:null});
    await LearnCoursePage({params:Promise.resolve({productId:"product"})});
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("course_access",{p_product_id:"product"});
  });
  it("fails closed when the entitlement lookup fails",async()=>{
    rpc.mockResolvedValue({data:null,error:{message:"Database offline"}});
    await expect(LearnCoursePage({params:Promise.resolve({productId:"product"})})).rejects.toThrow("ตรวจสอบสิทธิ์");
    expect(from).not.toHaveBeenCalled();
  });
});
