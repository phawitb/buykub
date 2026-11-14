import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckoutSuccess } from './CheckoutSuccess';

afterEach(() => vi.unstubAllGlobals());
function response(status: string, details: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind:'product', status, item_name:'Test PDF', assigned_key:null, ...details }), { status:200, headers:{'content-type':'application/json'} })));
}
describe('verified checkout status', () => {
  it('does not claim payment success while waiting for verification', async () => {
    response('created'); render(<CheckoutSuccess sessionId="cs_test_pending" />);
    expect(await screen.findByRole('heading', { name:'กำลังตรวจสอบการชำระเงิน' })).toBeInTheDocument();
    expect(screen.queryByText('Stripe รับการชำระเงินแล้ว', { exact:false })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name:'ดาวน์โหลดไฟล์สินค้า' })).not.toBeInTheDocument();
  });
  it('offers a private download only when the order is completed', async () => {
    response('completed'); render(<CheckoutSuccess sessionId="cs_test_paid" />);
    expect(await screen.findByRole('link', { name:'ดาวน์โหลดไฟล์สินค้า' })).toHaveAttribute('href','/api/stripe/download?session_id=cs_test_paid');
    expect(screen.getByRole('heading', { name:'ชำระเงินสำเร็จ' })).toBeInTheDocument();
  });
  it('does not offer downloads for cancelled orders', async () => {
    response('cancelled'); render(<CheckoutSuccess sessionId="cs_test_cancelled" />);
    expect(await screen.findByText('รายการนี้ถูกยกเลิกแล้ว')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name:'ดาวน์โหลดไฟล์สินค้า' })).not.toBeInTheDocument();
  });
});

it('shows full refund without download or payment success', async () => {
  response('refunded'); render(<CheckoutSuccess sessionId="cs_test_refunded" />);
  expect(await screen.findByRole('heading', {name:'คืนเงินแล้ว'})).toBeInTheDocument();
  expect(screen.queryByRole('link', {name:'ดาวน์โหลดไฟล์สินค้า'})).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', {name:'ชำระเงินสำเร็จ'})).not.toBeInTheDocument();
});


describe('course receipts', () => {
  it.each([
    ['2027-01-10T18:00:00.000Z', 'เรียนได้ถึง 11 มกราคม 2570'],
    [null, 'สิทธิ์เรียนตลอดไป'],
  ])('links completed courses to the classroom with expiry %s and no download', async (expiresAt, label) => {
    response('completed', { delivery_type:'course', product_id:'course-123', item_name:'My course', course_expires_at:expiresAt });
    render(<CheckoutSuccess sessionId="cs_test_course" />);
    expect(await screen.findByRole('link', { name:'เริ่มเรียนคอร์ส' })).toHaveAttribute('href','/learn/course-123');
    expect(screen.getByText(label!)).toBeInTheDocument();
    expect(screen.getByText(/บัญชี Google เดียวกับที่ใช้ซื้อคอร์ส/)).toBeInTheDocument();
    expect(screen.queryByRole('link', {name:'ดาวน์โหลดไฟล์สินค้า'})).not.toBeInTheDocument();
    expect(screen.queryByText('PRODUCT KEY ของคุณ')).not.toBeInTheDocument();
  });
  it('removes course access CTA after a full refund even when product metadata remains', async () => {
    response('refunded', { delivery_type:'course', product_id:'course-123', course_expires_at:null });
    render(<CheckoutSuccess sessionId="cs_test_course_refunded" />);
    expect(await screen.findByRole('heading', {name:'คืนเงินแล้ว'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name:'เริ่มเรียนคอร์ส'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name:'ดาวน์โหลดไฟล์สินค้า'})).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name:'คอร์สของคุณพร้อมเรียนแล้ว'})).not.toBeInTheDocument();
  });
});


it('keeps historical service receipt details without promising paused calendar delivery', async () => {
  response('completed', { kind:'service', item_name:'Historical booking', meet_url:'https://meet.google.com/abc-defg-hij' });
  render(<CheckoutSuccess sessionId="cs_test_historical_service" />);
  expect(await screen.findByRole('heading', {name:'ชำระเงินสำเร็จ'})).toBeInTheDocument();
  expect(screen.getByText(/ระบบจองบริการพักให้บริการชั่วคราว/)).toBeInTheDocument();
  expect(screen.queryByText(/กำลังเพิ่มนัดลงปฏิทิน/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', {name:'เปิด Google Meet'})).toHaveAttribute('href','https://meet.google.com/abc-defg-hij');
});
