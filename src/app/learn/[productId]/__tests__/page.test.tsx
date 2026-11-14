import { beforeEach,it,expect,vi } from 'vitest';
const m=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:m.getUser},rpc:m.rpc,from:m.from})}));
vi.mock('@/features/courses/sanitize',()=>({sanitizeLessonHtml:(s:string)=>s}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`)}}));
import Page from '../page';
beforeEach(()=>{
 vi.clearAllMocks();m.getUser.mockResolvedValue({data:{user:{id:'buyer',app_metadata:{provider:'google'}}}});m.rpc.mockResolvedValue({data:{allowed:true,reason:'active',expires_at:null},error:null});
 m.from.mockImplementation((table:string)=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{name:'Course'},error:null}),order:async()=>({data:[],error:null})};return q;});
});
it('loads the entitled course without querying the entire course library',async()=>{
 await Page({params:Promise.resolve({productId:'course'})});
 expect(m.rpc.mock.calls.map(c=>c[0])).toEqual(['course_access']);
 expect(m.from).toHaveBeenCalledWith('course_lessons');
});
it.each(['expired','refunded','not_purchased'])('never queries paid content when access is %s',async(reason)=>{
 m.rpc.mockResolvedValue({data:{allowed:false,reason},error:null});
 await Page({params:Promise.resolve({productId:'course'})});
 expect(m.from).not.toHaveBeenCalled();
});
it('does not fetch course content for anonymous visitors',async()=>{
 m.getUser.mockResolvedValue({data:{user:null}});
 await expect(Page({params:Promise.resolve({productId:'course'})})).rejects.toThrow('redirect:/login');
 expect(m.rpc).not.toHaveBeenCalled();expect(m.from).not.toHaveBeenCalled();
});
