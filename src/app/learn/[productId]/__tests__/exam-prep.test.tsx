import { beforeEach,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),from:vi.fn(),tables:[] as string[],product:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:m.getUser},rpc:m.rpc,from:m.from})}));
vi.mock('@/features/courses/exam-prep/ExamPrepClassroom',()=>({ExamPrepClassroom:()=>null}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`)}}));
import Page from '../page';
import { ExamPrepClassroom } from '@/features/courses/exam-prep/ExamPrepClassroom';
beforeEach(()=>{
 vi.clearAllMocks();m.tables.length=0;
 m.getUser.mockResolvedValue({data:{user:{id:'buyer',app_metadata:{provider:'google'}}}});
 m.rpc.mockResolvedValue({data:{allowed:true,reason:'active',expires_at:'2026-12-21T00:00:00Z'},error:null});
 m.product.mockResolvedValue({data:{name:'NST 30',course_format:'exam_prep'},error:null});
 m.from.mockImplementation((table:string)=>{m.tables.push(table);const q={select:(fields:string)=>{q.fields=fields;return q;},fields:'',eq:()=>q,maybeSingle:()=>m.product(q.fields),order:async()=>({data:[],error:null})};return q;});
});
it('renders the classroom with ids only: no pack, path or lessons in props',async()=>{
 const result=await Page({params:Promise.resolve({productId:'course'})});
 expect(result.type).toBe(ExamPrepClassroom);
 expect(result.props).toEqual({productId:'course',name:'NST 30',expiresAt:'2026-12-21T00:00:00Z',owner:false});
 expect(m.tables).toEqual(['products']);
});
it('treats every course as lessons on a database without the format column',async()=>{
 m.product.mockImplementation(async(fields:string)=>fields.includes('course_format')?{data:null,error:{code:'42703',message:'column products.course_format does not exist'}}:{data:{name:'Old'},error:null});
 const result=await Page({params:Promise.resolve({productId:'course'})});
 expect(result.type).not.toBe(ExamPrepClassroom);
 expect(m.tables).toContain('course_lessons');
});
it('reads nothing when access is denied',async()=>{
 m.rpc.mockResolvedValue({data:{allowed:false,reason:'expired'},error:null});
 await Page({params:Promise.resolve({productId:'course'})});
 expect(m.from).not.toHaveBeenCalled();
});
