import { UpgradePlans } from "./UpgradePlans";

export default function UpgradePage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-ink">อัปเกรดร้านของคุณ</h1>
      <p className="mt-1 text-sm text-muted">
        เลือกแผนที่เหมาะกับธุรกิจของคุณ
      </p>
      <div className="mt-7">
        <UpgradePlans />
      </div>
      <p className="mt-5 text-xs text-muted">
        ระบบชำระเงินของสมาชิกเป็น mockup และยังไม่มีการเรียกเก็บเงินจริง
      </p>
    </div>
  );
}
