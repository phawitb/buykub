import { LegalPage } from "@/components/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage title="เงื่อนไขการใช้บริการ" updatedAt="25 กรกฎาคม 2569">
      <section>
        <h2 className="text-lg font-semibold text-ink">1. ขอบเขตบริการ</h2>
        <p className="mt-2">
          Framelink ให้เครื่องมือสร้างหน้าร้าน ขายสินค้าดิจิทัล
          และจัดการบริการจอง ผู้ขายเป็นผู้รับผิดชอบเนื้อหา ราคา สิทธิในไฟล์
          และการให้บริการของตนเอง
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">2. ระบบทดลอง</h2>
        <p className="mt-2">
          ระบบชำระเงิน ค่าสมาชิก การโอนรายได้ และการส่งไฟล์ในเวอร์ชันนี้เป็น
          mockup เพื่อทดสอบ UX เท่านั้น ไม่มีการตัดเงินจริง
          และไม่ควรใช้เป็นหลักฐานการชำระเงิน
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
        <p className="mt-2">คำถามเกี่ยวกับเงื่อนไข: hello@framelink.app</p>
      </section>
    </LegalPage>
  );
}
