export function Testimonial() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <p className="text-3xl leading-snug text-ink">
        “ก่อนหน้านี้รับออเดอร์ทางแชท ต้องเช็คสลิปเองทุกคืน
        พอย้ายมาใช้ BUYKUB ลูกค้ากดซื้อจบเองทั้งหมด
        เดือนแรกขายได้หลักหมื่นโดยไม่ต้องตอบแชทเลยสักครั้ง”
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <div className="h-9 w-9 rounded-full bg-ink" />
        <div className="text-left">
          <p className="text-sm font-semibold text-ink">Studio เพ้นท์</p>
          <p className="text-xs text-muted">buykub.com/paintstudio</p>
        </div>
      </div>
    </section>
  );
}
