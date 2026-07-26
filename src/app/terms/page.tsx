import { LegalPage } from "@/components/LegalPage";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export default function TermsPage() {
  return (
    <LegalPage title="เงื่อนไขการใช้บริการ" updatedAt="25 กรกฎาคม 2569">
      <section>
        <h2 className="text-lg font-semibold text-ink">1. ขอบเขตบริการ</h2>
        <p className="mt-2">
          {BRAND_NAME} ให้เครื่องมือสร้างหน้าร้าน ขายสินค้าดิจิทัล
          และจัดการบริการจอง ผู้ขายเป็นผู้รับผิดชอบเนื้อหา ราคา สิทธิในไฟล์
          และการให้บริการของตนเอง
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">2. ค่าธรรมเนียมและระบบทดลอง</h2>
        <p className="mt-2">
          {BRAND_NAME} คิดค่าธรรมเนียม 5% ต่อออเดอร์ที่ขายได้
          โดยไม่มีค่าสมัครหรือค่ารายเดือน ระบบชำระเงิน การโอนรายได้
          และการส่งไฟล์ในเวอร์ชันนี้เป็น mockup เพื่อทดสอบ UX เท่านั้น
          ไม่มีการตัดเงินจริง และไม่ควรใช้เป็นหลักฐานการชำระเงิน
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">3. เนื้อหาที่ห้ามใช้</h2>
        <p className="mt-2">
          ห้ามเผยแพร่สิ่งผิดกฎหมาย ละเมิดลิขสิทธิ์ หลอกลวง
          หรือสร้างความเสียหายต่อผู้อื่น เราอาจระงับเนื้อหาที่ฝ่าฝืนเพื่อความปลอดภัยของระบบ
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">4. การติดต่อ</h2>
        <p className="mt-2">คำถามเกี่ยวกับเงื่อนไข: {SUPPORT_EMAIL}</p>
      </section>
    </LegalPage>
  );
}
