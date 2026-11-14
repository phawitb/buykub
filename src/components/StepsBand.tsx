import { ArrowRightIcon, BoxIcon, ChartIcon, ShopIcon } from "./icons";

const steps = [
  { n: "1", Icon: ShopIcon, title: "สร้างร้าน", body: "ตั้งร้านของคุณได้ทันที" },
  { n: "2", Icon: BoxIcon, title: "เพิ่มสินค้า", body: "อัปโหลดหรือสร้างสินค้า" },
  { n: "3", Icon: ChartIcon, title: "รับรายได้", body: "เริ่มขายได้ทันที" },
];

export function StepsBand() {
  return (
    <section id="how" className="bg-ground-dark py-20 text-on-ink sm:py-24">
      <div className="shell grid gap-14 px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div>
          <h2 className="text-3xl leading-tight text-on-ink sm:text-[2.25rem]">
            เริ่มต้นง่าย
            <br />
            เติบโตในแบบของคุณ
          </h2>
          <p className="measure mt-5 text-[15px] leading-8 text-on-ink-soft">
            เปิดร้านได้ในไม่กี่นาที พร้อมเครื่องมือที่ครบครัน
            และค่าธรรมเนียมเพียง 5% ต่อออเดอร์
          </p>
        </div>

        {/* Arrows are their own flex items between the steps. The previous
            version positioned them absolutely with no positioned ancestor, so
            they landed outside the viewport and pushed the page 236px wide. */}
        <ol className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-2">
          {steps.map((step, index) => (
            <li key={step.n} className="contents">
              <div className="flex flex-1 items-start gap-4 sm:block sm:text-center">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-white/15 text-on-ink sm:mx-auto">
                  <step.Icon className="size-6" />
                </span>
                <div className="sm:mt-5">
                  <p className="text-sm font-medium text-on-ink">
                    <span data-numeric>{step.n}.</span> {step.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-6 text-on-ink-soft">{step.body}</p>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div aria-hidden className="hidden shrink-0 pt-[1.6rem] sm:block">
                  <ArrowRightIcon className="size-5 text-on-ink-soft" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
