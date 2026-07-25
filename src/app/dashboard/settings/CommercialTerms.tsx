const terms = [
  "ค่าธรรมเนียม 5% ต่อออเดอร์",
  "สินค้าและบริการจองไม่จำกัด",
  "ไม่มีลายน้ำ",
  "โอนเงินทุกวันจันทร์",
];

export function CommercialTerms() {
  return (
    <section aria-labelledby="commercial-terms-title">
      <h2 id="commercial-terms-title" className="text-sm font-semibold text-ink">
        เงื่อนไขการใช้งาน
      </h2>
      <div className="mt-4 rounded-2xl border border-line bg-paper-dim p-5">
        <p className="text-sm font-semibold text-ink">
          ทุกคนใช้ฟีเจอร์ได้ครบ ไม่มีค่าสมาชิกรายเดือน
        </p>
        <ul className="mt-4 grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
          {terms.map((term) => (
            <li key={term} className="flex items-start gap-2">
              <span className="text-accent" aria-hidden>
                ✓
              </span>
              <span>{term}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
