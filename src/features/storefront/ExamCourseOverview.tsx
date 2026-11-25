import type { ExamSummary } from "@/features/courses/exam-prep/pack";

const number = (value: number) => value.toLocaleString("th-TH");

/** What an exam-prep course contains, from its public summary. Counts only; no lesson text or questions. */
export function ExamCourseOverview({summary, accessDays}:{summary:ExamSummary;accessDays:number|null}) {
  const drill = summary.mode === "drill";
  const mockStat = ["ข้อสอบจำลอง", `${summary.mocks} ชุด`, `ชุดละ ${number(summary.mockQuestions)} ข้อ · ${summary.mockMinutes} นาที`];
  const stats = drill ? [
    ["คลังข้อสอบ", `${number(summary.questions)} ข้อ`, "เฉลยและคำอธิบายทุกข้อ"],
    ["ฝึกโจทย์", `${number(summary.practice)} ข้อ`, "เลือกฝึกตามวิชาและหัวข้อ"],
    summary.mocks > 0 ? mockStat : ["วิชา", `${summary.subjects.length} วิชา`, summary.subjects.map(subject => subject.short).join(" · ")],
    ["สมุดข้อผิด", "ทบทวนซ้ำ", "ข้อที่ตอบผิดวนกลับมาให้ทำใหม่"],
  ] : [
    ["แผนอ่าน", `${summary.days} วัน`, "บอกว่าวันนี้อ่านอะไร ฝึกข้อไหน"],
    ["คลังข้อสอบ", `${number(summary.questions)} ข้อ`, "เฉลยและคำอธิบายทุกข้อ"],
    mockStat,
    ["สรุปบทเรียน", `${summary.chapters} บท`, `${summary.subjects.length} วิชา`],
  ];
  return <section className="mt-8 border-t border-line pt-7">
    <p className="text-[11px] font-semibold tracking-[0.22em] text-muted">ในคอร์สนี้</p>
    <h2 className="mt-3 text-xl font-bold text-ink">{drill ? "ห้องฝึกข้อสอบออนไลน์" : "ห้องเรียนติวสอบออนไลน์"}</h2>
    <dl className="mt-5 grid grid-cols-2 gap-3">
      {stats.map(([label, value, note]) => <div key={label} className="rounded-xl border border-line bg-paper p-4">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-1 text-lg font-bold text-ink">{value}</dd>
        <dd className="mt-1 text-[11px] leading-4 text-muted">{note}</dd>
      </div>)}
    </dl>
    <h3 className="mt-6 text-sm font-semibold text-ink">{drill && !summary.mocks ? "วิชาและจำนวนข้อ" : "วิชาและสัดส่วนข้อสอบจำลอง"}</h3>
    <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
      {summary.subjects.map(subject => <li key={subject.key} className="flex items-baseline justify-between gap-3 py-2.5">
        <span className="text-ink-soft">{subject.name}</span>
        <span className="shrink-0 text-xs text-muted">{drill ? (summary.mocks ? `${subject.perSet} ข้อต่อชุด · รวม ${number(subject.questions)} ข้อ` : `${number(subject.questions)} ข้อ`) : `${subject.perSet} ข้อต่อชุด · ${subject.chapters} บท`}</span>
      </li>)}
    </ul>
    {summary.parts.length > 0 && summary.mocks > 0 && <p className="mt-4 text-xs leading-6 text-muted">
      ผลข้อสอบจำลองแยกตามภาค: {summary.parts.map(part => `${part.name} ${Math.ceil(part.max * part.pass)}/${part.max} ข้อ`).join(" · ")} (เกณฑ์ร้อยละ {Math.round(summary.parts[0].pass * 100)} ใช้เพื่อฝึก ไม่ใช่คะแนนตัดจริง)
    </p>}
    <ul className="mt-5 space-y-2 text-sm text-ink-soft">
      <li>· เรียนผ่านเว็บด้วยบัญชี Google ที่ใช้ซื้อ ความคืบหน้าบันทึกในบัญชี เปิดต่อได้ทุกอุปกรณ์</li>
      <li>· {accessDays ? `เข้าเรียนได้ ${accessDays} วันนับจากชำระเงิน` : "เข้าเรียนได้ไม่จำกัดเวลา"}</li>
      {drill && <li>· มีเฉพาะแบบฝึกและข้อสอบ ไม่มีสมุดสรุป PDF แผนอ่าน หรือบทเรียน</li>}
    </ul>
  </section>;
}
