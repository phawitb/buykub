import { LegalPage } from "@/components/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/brand";

export default function PrivacyPage() {
  return (
    <LegalPage title="นโยบายความเป็นส่วนตัว" updatedAt="25 กรกฎาคม 2569">
      <section>
        <h2 className="text-lg font-semibold text-ink">ข้อมูลที่จัดเก็บ</h2>
        <p className="mt-2">
          เราจัดเก็บข้อมูลบัญชี Google ที่จำเป็น ข้อมูลร้าน สินค้า
          การตั้งค่าบริการจอง และออเดอร์ mock ที่ผู้ใช้สร้าง
          เพื่อให้ระบบทำงานตามที่ร้องขอ
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">Analytics</h2>
        <p className="mt-2">
          ระบบบันทึกเหตุการณ์ดูสินค้า กดซื้อ เปิด checkout และซื้อสำเร็จ
          ด้วยรหัสผู้เข้าชมแบบสุ่ม พร้อม deduplicate ทุก 30 นาที
          โดยไม่บันทึกชื่อหรืออีเมลในเหตุการณ์ analytics
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">การจัดเก็บไฟล์</h2>
        <p className="mt-2">
          รูปสินค้าเป็นไฟล์สาธารณะเพื่อแสดงหน้าร้าน
          ส่วนไฟล์สินค้าดิจิทัลเก็บในพื้นที่ส่วนตัวและอนุญาตให้เจ้าของร้านจัดการเท่านั้น
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">สิทธิของคุณ</h2>
        <p className="mt-2">
          คุณสามารถแก้ไขหรือลบข้อมูลร้านและสินค้าได้จาก dashboard
          หรือติดต่อ {SUPPORT_EMAIL} เพื่อสอบถามเกี่ยวกับข้อมูลส่วนบุคคล
        </p>
      </section>
    </LegalPage>
  );
}
