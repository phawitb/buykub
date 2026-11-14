export type ProductKeyEmailInput = {
  shopName: string;
  productName: string;
  orderId: string;
  keyValue: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

export function buildProductKeyEmail(input: ProductKeyEmailInput) {
  const orderReference = input.orderId.slice(0, 8).toUpperCase();
  const subject = `Product Key สำหรับ ${input.productName} · #${orderReference}`;
  const text = [
    `ขอบคุณสำหรับคำสั่งซื้อจาก ${input.shopName}`,
    "",
    `สินค้า: ${input.productName}`,
    `เลขที่ออเดอร์: #${orderReference}`,
    `Product Key: ${input.keyValue}`,
    "",
    "กรุณาเก็บอีเมลนี้ไว้เป็นหลักฐาน ไม่ควรส่งต่อ Product Key ให้ผู้อื่น",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#18181b">
      <p style="font-size:13px;color:#2563eb;font-weight:700">BUYKUB</p>
      <h1 style="font-size:24px;margin:12px 0">Product Key ของคุณพร้อมแล้ว</h1>
      <p>ขอบคุณสำหรับคำสั่งซื้อจาก <strong>${escapeHtml(input.shopName)}</strong></p>
      <div style="background:#f4f4f5;border-radius:16px;padding:20px;margin:24px 0">
        <p style="margin:0 0 8px;color:#71717a;font-size:13px">${escapeHtml(input.productName)} · #${escapeHtml(orderReference)}</p>
        <code style="display:block;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:16px;font-size:17px;font-weight:700;word-break:break-all">${escapeHtml(input.keyValue)}</code>
      </div>
      <p style="font-size:13px;color:#71717a">กรุณาเก็บอีเมลนี้ไว้เป็นหลักฐาน และไม่ควรส่งต่อ Product Key ให้ผู้อื่น</p>
    </div>
  `.trim();

  return { subject, text, html };
}

export function buildProductFileEmail(input: Omit<ProductKeyEmailInput, 'keyValue'> & { sessionId: string }) {
  const reference = input.orderId.slice(0, 8).toUpperCase();
  const url = `https://buykub.com/checkout/success?session_id=${encodeURIComponent(input.sessionId)}`;
  return {
    subject: `ดาวน์โหลด ${input.productName} · #${reference}`,
    text: `ขอบคุณสำหรับคำสั่งซื้อจาก ${input.shopName}\nสินค้า: ${input.productName}\nเลขที่ออเดอร์: #${reference}\n\nเปิดหน้าคำสั่งซื้อและดาวน์โหลดสินค้า:\n${url}\n\nเก็บอีเมลนี้ไว้เพื่อกลับมาดาวน์โหลด และอย่าส่งต่อลิงก์ให้ผู้อื่น`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18181b"><p style="color:#2563eb;font-weight:700">BUYKUB</p><h1>ไฟล์สินค้าของคุณพร้อมแล้ว</h1><p>ขอบคุณสำหรับคำสั่งซื้อจาก <strong>${escapeHtml(input.shopName)}</strong></p><p>${escapeHtml(input.productName)} · #${escapeHtml(reference)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 24px;background:#2563eb;color:white;border-radius:12px">เปิดคำสั่งซื้อและดาวน์โหลด</a></p><p>เก็บอีเมลนี้ไว้เพื่อกลับมาดาวน์โหลด และอย่าส่งต่อลิงก์ให้ผู้อื่น</p></div>`,
  };
}

export function buildCourseEmail(input: Omit<ProductKeyEmailInput, 'keyValue'> & { productId: string; expiresAt: string | null }) {
  const reference = input.orderId.slice(0, 8).toUpperCase();
  const url = `https://buykub.com/learn/${encodeURIComponent(input.productId)}`;
  const duration = input.expiresAt ? `สิทธิ์เรียนถึง ${input.expiresAt}` : 'สิทธิ์เรียนตลอดไป';
  const instructions = 'เข้าสู่ระบบด้วยบัญชี Google เดียวกับที่ใช้ซื้อคอร์ส เพื่อกลับมาเรียนและเปิดเอกสารประกอบ';
  return {
    subject: `เข้าเรียน ${input.productName} · #${reference}`,
    text: `ขอบคุณสำหรับคำสั่งซื้อจาก ${input.shopName}\nคอร์ส: ${input.productName}\nเลขที่ออเดอร์: #${reference}\n${duration}\n\n${instructions}\n${url}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18181b"><p style="color:#2563eb;font-weight:700">BUYKUB</p><h1>คอร์สของคุณพร้อมเรียนแล้ว</h1><p>ขอบคุณสำหรับคำสั่งซื้อจาก <strong>${escapeHtml(input.shopName)}</strong></p><p>${escapeHtml(input.productName)} · #${reference}</p><p>${escapeHtml(duration)}</p><p>${instructions}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 24px;background:#2563eb;color:white;border-radius:12px">เข้าเรียนคอร์ส</a></p></div>`,
  };
}
