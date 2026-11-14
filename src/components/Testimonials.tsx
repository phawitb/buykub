import { StarIcon } from "./icons";

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  rating: number;
};

/**
 * PLACEHOLDER COPY — none of these twenty sellers exist.
 *
 * Written to read naturally, with a mix of Thai script and romanised Thai
 * names, so the section can be judged at full fidelity. BUYKUB has no customers
 * to quote yet: the catalog was reset on 2026-11-13 and no paid live order has
 * settled. Swap this array for real, permissioned quotes and pass
 * `placeholder={false}`; until then the section says so on the page, because an
 * invented review presented as genuine is consumer deception and unlawful in
 * the markets this site serves.
 */
export const PLACEHOLDER_TESTIMONIALS: Testimonial[] = [
  { name: "ณัฐพร ส.", role: "เจ้าของร้านคอร์สออนไลน์", rating: 5,
    quote: "เมื่อก่อนรับออเดอร์ทางแชท ต้องคอยเช็กสลิปเองทุกคืน ย้ายมาใช้ BUYKUB แล้วลูกค้ากดซื้อจบเองได้ทั้งหมด" },
  { name: "Nattaya P.", role: "เจ้าของร้านชีทสรุป", rating: 5,
    quote: "ขายชีทสรุปอยู่แล้ว แค่ย้ายไฟล์มาไว้ที่เดียว ลูกค้าจ่ายแล้วได้ลิงก์ดาวน์โหลดทันที ไม่ต้องส่งเอง" },
  { name: "พิมพ์ชนก ร.", role: "ครีเอเตอร์สายออกแบบ", rating: 5,
    quote: "ตั้งร้านเสร็จใน 5 นาที แปะลิงก์ไว้ใน bio แล้วก็ปล่อยให้ระบบทำงานแทนได้เลย" },
  { name: "Siriwat K.", role: "ครีเอเตอร์สาย AI", rating: 5,
    quote: "ชอบที่ลิงก์ร้านเป็นชื่อเราเอง ส่งให้ลูกค้าในแชทแล้วดูน่าเชื่อถือกว่าส่งเลขบัญชีเปล่า ๆ" },
  { name: "ธนกฤต ว.", role: "ติวเตอร์ออนไลน์", rating: 5,
    quote: "เปิดคอร์สแล้วกำหนดอายุการเข้าเรียนได้ ไม่ต้องมานั่งไล่ปิดสิทธิ์ให้ทีละคนเหมือนเมื่อก่อน" },
  { name: "Pattarapon S.", role: "คนขายฟอนต์ไทย", rating: 4,
    quote: "ระบบคีย์สินค้าตัดสต็อกให้เอง ขายฟอนต์พร้อมกันหลายคนก็ไม่เคยซ้ำ อันนี้ช่วยได้เยอะ" },
  { name: "สุชานันท์ พ.", role: "นักเขียน e-book", rating: 5,
    quote: "ลูกค้าสแกนพร้อมเพย์จ่ายจบในหน้าเดียว ไม่ต้องสลับไปแอปธนาคารแล้วกลับมาส่งสลิป" },
  { name: "Kanyarat T.", role: "ติวเตอร์คณิตศาสตร์", rating: 5,
    quote: "ขายชีทกับคอร์สอยู่ในร้านเดียวกัน ลูกค้าเห็นของทั้งหมดในลิงก์เดียว ยอดต่อคนดีขึ้น" },
  { name: "กิตติพงศ์ จ.", role: "คนขายพรีเซ็ตภาพถ่าย", rating: 5,
    quote: "อัปโหลดไฟล์ครั้งเดียวแล้วลืมไปได้เลย ระบบส่งให้ลูกค้าเองทุกครั้งที่มีคนซื้อ" },
  { name: "Thanaphon C.", role: "คนขาย LUT สำหรับวิดีโอ", rating: 4,
    quote: "หน้าร้านเรียบ ๆ ไม่มีอะไรมากวนสายตา ลูกค้าเข้ามาก็เห็นของกับปุ่มจ่ายเงินเลย" },
  { name: "อารยา ม.", role: "โค้ชด้านการเงิน", rating: 5,
    quote: "ไม่ต้องจ้างใครทำเว็บ ไม่ต้องต่ออายุโฮสต์ จ่ายแค่ตอนขายได้จริงเท่านั้น" },
  { name: "Chanisara M.", role: "นักวาดภาพประกอบ", rating: 5,
    quote: "เคยกลัวว่าจะตั้งค่ายาก แต่กรอกชื่อร้านกับอัปโหลดรูปก็เปิดขายได้แล้ว" },
  { name: "ภูริช ต.", role: "คนขายเทมเพลต Notion", rating: 5,
    quote: "ลิงก์สินค้าแยกของใครของมัน เอาไปยิงแอดแยกตัวได้ ดูง่ายว่าตัวไหนขายดี" },
  { name: "Worrawit L.", role: "คนทำคอร์สถ่ายภาพ", rating: 5,
    quote: "อัปโหลดเอกสารประกอบบทเรียนได้ ลูกค้าโหลดได้เฉพาะคนที่จ่ายแล้วเท่านั้น" },
  { name: "เบญญาภา ค.", role: "ครูสอนภาษา", rating: 4,
    quote: "ชอบที่หน้าเว็บเป็นภาษาไทยทั้งหมด แม่ ๆ ที่ซื้อคอร์สให้ลูกก็กดเองได้ไม่ต้องถาม" },
  { name: "Supansa R.", role: "คนขาย e-book สูตรอาหาร", rating: 5,
    quote: "ตอนกลางคืนก็ยังมีออเดอร์เข้า ตื่นมาเห็นว่าส่งของให้ลูกค้าเรียบร้อยแล้ว" },
  { name: "วรินทร ส.", role: "นักออกแบบกราฟิก", rating: 5,
    quote: "ย้ายจากขายผ่านอินบ็อกซ์มาใช้ลิงก์ ไม่ต้องตอบคำถามเดิมซ้ำ ๆ ทุกวันแล้ว" },
  { name: "Jirayu N.", role: "โปรแกรมเมอร์ฟรีแลนซ์", rating: 5,
    quote: "ขายสคริปต์เป็นคีย์ ระบบจัดการสต็อกให้หมด ผมแค่เอาคีย์ใส่เข้าไปรอบเดียว" },
  { name: "ชยพล อ.", role: "คนขายคีย์ซอฟต์แวร์", rating: 5,
    quote: "ยอดที่ขายได้ดูย้อนหลังได้ในหน้า Analytics ไม่ต้องจดใส่ Excel เองอีกแล้ว" },
  { name: "Alisa W.", role: "คนทำเทมเพลตสไลด์", rating: 5,
    quote: "เปิดร้านฟรีจริง ไม่มีค่ารายเดือนมาเก็บทีหลัง หักเฉพาะตอนมีคนซื้อเท่านั้น" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <p className="flex items-center gap-0.5" aria-label={`ให้คะแนน ${rating} จาก 5 ดาว`}>
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          key={index}
          className={`size-4 ${index < rating ? "text-amber-500" : "text-line-strong"}`}
        />
      ))}
    </p>
  );
}

export function Testimonials({
  items = PLACEHOLDER_TESTIMONIALS,
  placeholder = true,
}: {
  items?: Testimonial[];
  placeholder?: boolean;
}) {
  if (items.length === 0) return null;

  // The track carries the list twice; the second pass is decorative so screen
  // readers and tab order only ever meet each review once.
  const lanes = [
    { items, hidden: false },
    { items, hidden: true },
  ];

  return (
    <section aria-labelledby="testimonials-title" className="bg-paper-dim py-20 sm:py-24">
      <div className="shell px-6">
        <h2 id="testimonials-title" className="text-center text-3xl text-ink sm:text-[2.25rem]">
          รีวิวจากผู้ขาย
        </h2>

        {placeholder && (
          <p className="mx-auto mt-5 w-fit rounded-full border border-line bg-paper px-4 py-1.5 text-center text-xs font-medium text-muted">
            ข้อความตัวอย่างสำหรับจัดหน้า · ยังไม่ใช่รีวิวจากผู้ขายจริง
          </p>
        )}
      </div>

      <div className="marquee mt-12" style={{ ["--marquee-duration" as string]: `${items.length * 5}s` }}>
        <div className="marquee-track">
          {lanes.map((lane, laneIndex) => (
            <ul
              key={laneIndex}
              className="flex shrink-0 gap-6"
              aria-hidden={lane.hidden || undefined}
            >
              {lane.items.map((item) => (
                <li
                  key={item.name}
                  className="card flex w-[20rem] shrink-0 flex-col p-6 sm:w-[22rem]"
                >
                  <Stars rating={item.rating} />
                  <blockquote className="mt-4 flex-1 text-sm leading-7 text-ink-soft">
                    “{item.quote}”
                  </blockquote>
                  <footer className="mt-5 border-t border-line pt-4">
                    <p className="text-sm font-medium text-ink">{item.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.role}</p>
                  </footer>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
