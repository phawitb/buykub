import {fireEvent, render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {CurriculumEditor} from "../CurriculumEditor";
const {rpc,refresh,invalidate,publish}=vi.hoisted(()=>({rpc:vi.fn(),refresh:vi.fn(),invalidate:vi.fn(),publish:vi.fn()}));
vi.mock("@/lib/storefront/invalidate",()=>({invalidatePublicCatalog:invalidate,CATALOG_REFRESH_WARNING:"Refresh delayed"}));
vi.mock("@/lib/supabase/client",()=>({createClient:()=>({rpc,from:()=>({update:()=>({eq:publish})})})}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
vi.mock("@/features/products/components/RichTextEditor",()=>({RichTextEditor:({value,onChange}:{value:string;onChange:(value:string)=>void})=><textarea aria-label="เนื้อหาบทเรียน" value={value} onChange={event=>onChange(event.target.value)}/>}));
const lessons=[{id:"11111111-1111-4111-8111-111111111111",title:"First",position:0,content_html:"<p>First text</p>",youtube_url:null,documents:[],published:true},{id:"22222222-2222-4222-8222-222222222222",title:"Second",position:1,content_html:"",youtube_url:null,documents:[],published:true}];
beforeEach(()=>{rpc.mockReset();refresh.mockReset();invalidate.mockReset();invalidate.mockResolvedValue(true);publish.mockResolvedValue({error:null});});
describe("curriculum authoring",()=>{
  it("persists reordered lessons transactionally and keeps unsaved changes on failure",async()=>{
    const user=userEvent.setup();
    rpc.mockResolvedValueOnce({error:{message:"Network unavailable"}}).mockResolvedValueOnce({error:null});
    render(<CurriculumEditor productId="product" productName="Course" userId="owner" published initialLessons={lessons}/>);
    await user.click(screen.getByRole("button",{name:"เลื่อนบทเรียนลง"}));
    await user.click(screen.getByRole("button",{name:"บันทึกบทเรียน"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByText("มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก")).toBeInTheDocument();
    expect(rpc.mock.calls[0][1].p_lessons.map((lesson:{id:string;position:number})=>[lesson.id,lesson.position])).toEqual([["22222222-2222-4222-8222-222222222222",0],["11111111-1111-4111-8111-111111111111",1]]);
    await user.click(screen.getByRole("button",{name:"บันทึกบทเรียน"}));
    await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("บันทึกบทเรียนแล้ว"));
  });
  it("blocks publishing an empty course",async()=>{
    render(<CurriculumEditor productId="product" productName="Course" userId="owner" published={false} initialLessons={[]}/>);
    fireEvent.click(screen.getByRole("button",{name:"บันทึกและเผยแพร่คอร์ส"}));
    expect(screen.getByRole("alert")).toHaveTextContent("อย่างน้อย 1 บท");
    expect(rpc).not.toHaveBeenCalled();
  });
});

it("invalidates a cached storefront when publishing a draft course",async()=>{
 rpc.mockResolvedValue({error:null});
 render(<CurriculumEditor productId="product" productName="Course" userId="owner" published={false} initialLessons={lessons}/>);
 fireEvent.click(screen.getByRole("button",{name:"บันทึกและเผยแพร่คอร์ส"}));
 await waitFor(()=>expect(invalidate).toHaveBeenCalledOnce());
});
