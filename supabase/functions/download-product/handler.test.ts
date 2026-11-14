import { describe, expect, it, vi } from 'vitest';
import { createDownloadHandler } from './handler';

const sessionId = 'cs_test_' + 'a'.repeat(32);
const paid = { status: 'completed', kind: 'product', order: { status: 'paid', sessionId }, product: { deliveryType: 'file', filePath: 'owner-1/book.pdf', fileName: 'book.pdf' }, ownerId: 'owner-1' };
function setup(record: typeof paid | null = paid) {
  const findPurchase = vi.fn().mockResolvedValue(record);
  const sign = vi.fn().mockResolvedValue('https://storage.example/signed');
  return { findPurchase, sign, handler: createDownloadHandler({ findPurchase, sign }) };
}
const request = () => new Request('https://example.com/download', { method: 'POST', body: JSON.stringify({ sessionId }) });
describe('private paid file delivery', () => {
  it('only signs the purchased owner-prefixed file for a paid order', async () => {
    const { handler, sign } = setup(); const r = await handler(request());
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ url: 'https://storage.example/signed', fileName: 'book.pdf', expiresIn: 300 });
    expect(sign).toHaveBeenCalledWith('owner-1/book.pdf', 300, 'book.pdf');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it.each(['created','cancelled'])('denies %s checkouts', async (status) => {
    const { handler, sign } = setup({ ...paid, status });
    expect((await handler(request())).status).toBe(403); expect(sign).not.toHaveBeenCalled();
  });
  it('denies refunded orders', async () => {
    const { handler, sign } = setup({ ...paid, order: { status:'refunded', sessionId } });
    expect((await handler(request())).status).toBe(403); expect(sign).not.toHaveBeenCalled();
  });
  it('denies a product pointing at another seller file', async () => {
    const { handler, sign } = setup({ ...paid, product: { ...paid.product, filePath:'other-owner/book.pdf' } });
    expect((await handler(request())).status).toBe(403); expect(sign).not.toHaveBeenCalled();
  });
  it.each(['owner-1/%2e%2e/victim/book.pdf', 'owner-1/..\\victim/book.pdf', 'owner-1/%252e%252e/victim/book.pdf'])('denies noncanonical path %s before signing', async (filePath) => {
    const { handler, sign } = setup({ ...paid, product: { ...paid.product, filePath } });
    expect((await handler(request())).status).toBe(403); expect(sign).not.toHaveBeenCalled();
  });
  it('denies a checkout whose order has a different session', async () => {
    const { handler, sign } = setup({ ...paid, order: { status:'paid', sessionId:'cs_test_other' } });
    expect((await handler(request())).status).toBe(403); expect(sign).not.toHaveBeenCalled();
  });
  it('returns not found without disclosing file details', async () => {
    const { handler, sign } = setup(null); expect((await handler(request())).status).toBe(404); expect(sign).not.toHaveBeenCalled();
  });
});

it('accepts a native PromptPay receipt with the same paid-order authorization', async () => {
  const receipt='pp_11111111-1111-4111-8111-111111111111';
  const {handler,sign}=setup({...paid,order:{status:'paid',sessionId:receipt}});
  const response=await handler(new Request('https://example.com/download',{method:'POST',body:JSON.stringify({sessionId:receipt})}));
  expect(response.status).toBe(200);expect(sign).toHaveBeenCalledTimes(1);
});
