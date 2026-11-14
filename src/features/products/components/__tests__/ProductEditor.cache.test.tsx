import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ProductEditor } from '../ProductEditor';
const m=vi.hoisted(()=>({invalidate:vi.fn(async()=>true),update:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/storefront/invalidate',()=>({invalidatePublicCatalog:m.invalidate,CATALOG_REFRESH_WARNING:'Refresh delayed'}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({from:()=>({update:()=>({eq:()=>({eq:m.update})})}),rpc:m.rpc})}));
vi.mock('../RichTextEditor',()=>({RichTextEditor:()=>null}));
it('refreshes already committed listing edits even when importing keys then fails',async()=>{
 m.update.mockResolvedValue({error:null});m.rpc.mockResolvedValue({error:{message:'Key import failed'}});
 render(<ProductEditor mode="edit" shopId="shop" userId="owner" productId="product" existingSlugs={[]} initialValue={{deliveryType:'key',courseAccessDays:'',keyInput:'TEST-KEY',keyInventory:{available:1,assigned:0,disabled:0},name:'Test keys',price:'50',comparePrice:'',category:'OTHER',descriptionHtml:'',productFile:null,images:[],highlights:[],faq:[],published:false}}/>);
 fireEvent.change(screen.getByLabelText('ชื่อสินค้า *'),{target:{value:'Edited keys'}});
 fireEvent.click(screen.getByRole('button',{name:'บันทึกการเปลี่ยนแปลง'}));
 await waitFor(()=>expect(m.rpc).toHaveBeenCalled());
 expect(m.invalidate).toHaveBeenCalledOnce();
 expect(m.invalidate.mock.invocationCallOrder[0]).toBeLessThan(m.rpc.mock.invocationCallOrder[0]);
 expect(await screen.findByText(/Key import failed/)).toBeInTheDocument();
});
