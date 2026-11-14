import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PromptpayCheckout } from './PromptpayCheckout';
afterEach(()=>vi.unstubAllGlobals());
it('renders the QR directly and rerender never creates a payment',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'awaiting_payment',name:'Book',amountCents:38900,qrUrl:'https://stripe.example/qr.png'})});
 vi.stubGlobal('fetch',fetcher);
 const view=render(<PromptpayCheckout receipt="pp_receipt"/>);
 expect(await screen.findByRole('img',{name:'QR PromptPay สำหรับรายการนี้'})).toHaveAttribute('src','https://stripe.example/qr.png');
 view.rerender(<PromptpayCheckout receipt="pp_receipt"/>);
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect(fetcher).toHaveBeenCalledWith('/api/stripe/promptpay?receipt=pp_receipt',expect.not.objectContaining({method:'POST'}));
});
it('offers a retry after network errors instead of an endless spinner',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Network unavailable')));
 render(<PromptpayCheckout receipt="pp_receipt"/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
 expect(screen.getByRole('button',{name:'ตรวจสอบอีกครั้ง'})).toBeInTheDocument();
 expect(screen.getByRole('status')).not.toHaveTextContent('กำลังโหลด QR');
});
