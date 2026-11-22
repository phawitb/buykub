/* Exam-prep classroom engine.
 * ExamPrep.mount(root, pack, { store, mascot }) renders a full study app (plan, notes, practice, mocks, review)
 * inside `root`. All content comes from `pack`; progress goes through `store` ({ load(): state|null, save(state) }).
 * Routing uses location.hash, so one classroom per page. Styles live in engine.css under .exam-prep. */
(function () {
"use strict";

const DAY = 864e5;
const REASONS = ["ไม่รู้หลัก", "อ่านเงื่อนไขตก", "คำนวณผิด", "รู้แต่เวลาไม่พอ", "เดาถูกแต่ไม่มั่นใจ"];
const REASON_FIX = {
  "ไม่รู้หลัก": "กลับไปอ่านบทแล้วเล่าวิธีด้วยคำตัวเอง",
  "อ่านเงื่อนไขตก": "ฝึกวงคำสำคัญ เช่น อย่างน้อย ไม่คืน ยกเว้น",
  "คำนวณผิด": "ประมาณคำตอบก่อน แล้วตรวจหน่วย ฐานเทียบ และเครื่องหมาย",
  "รู้แต่เวลาไม่พอ": "ฝึกเลือกทำ ข้ามข้อยากแล้วกลับมา",
  "เดาถูกแต่ไม่มั่นใจ": "ทำซ้ำหลังเว้นช่วง จนอธิบายเหตุผลได้",
};
const CIRC = ["①", "②", "③", "④"];
const KIND = { study: "เรียน+ฝึก", repair: "ซ่อมจุดอ่อน", mock: "จำลองสอบ", analyze: "วิเคราะห์", final: "วันสุดท้าย" };
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  notes: '<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z"/>',
  practice: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/>',
  mock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  review: '<path d="M5 3h11l3 3v15H5zM9 9h6M9 13h6M9 17h3"/>',
};

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtN = n => n.toLocaleString("en-US");
const fmtClock = ms => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const isoDate = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const parseIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
const thDate = (t, o = { day: "numeric", month: "short" }) => new Date(t).toLocaleDateString("th-TH", o);
const dueIn = d => today0() + d * DAY;
const subjChip = (s, extra = "") => `<span class="chip subj s-${s.key}" ${extra}>${esc(s.short)}</span>`;
const bar = (pct, cls = "") => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const bar2 = (st, cls = "") => `<div class="bar two ${cls}" role="img" aria-label="ถูก ${st.ok} ผิด ${st.done - st.ok} จาก ${st.total}"><i class="ok" style="width:${st.ok / st.total * 100}%"></i><i class="bad" style="width:${(st.done - st.ok) / st.total * 100}%"></i></div>`;

function inline(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([A-Z]{1,3}\d[^\]]*)\]/g, '<span class="ref">[$1]</span>');
}
function md(text) {
  const blocks = String(text || "").split(/\n\s*\n/);
  return blocks.map(b => {
    b = b.trim(); if (!b || /^<div id="[\w-]+"><\/div>$/.test(b)) return "";
    const lines = b.split("\n");
    if (lines[0].startsWith("|")) {
      const rows = lines.filter(l => !/^\|\s*:?-{2,}/.test(l)).map(l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
      const align = (lines[1] || "").replace(/^\||\|$/g, "").split("|").map(c => /-:\s*$/.test(c));
      const [h, ...body] = rows;
      return `<div class="tbl"><table><thead><tr>${h.map((c, i) => `<th class="${align[i] ? "r" : ""}">${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map(r => `<tr>${r.map((c, i) => `<td class="${align[i] ? "r num" : ""}">${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    if (lines[0].startsWith("### ")) return `<h4>${inline(lines[0].slice(4))}</h4>` + (lines.length > 1 ? md(lines.slice(1).join("\n")) : "");
    if (lines.every(l => /^\d+\.\s/.test(l))) return `<ol>${lines.map(l => `<li>${inline(l.replace(/^\d+\.\s/, ""))}</li>`).join("")}</ol>`;
    if (lines.every(l => /^[-*]\s/.test(l))) return `<ul>${lines.map(l => `<li>${inline(l.replace(/^[-*]\s/, ""))}</li>`).join("")}</ul>`;
    const m = b.match(/^\*\*(.+?)\*\*/);
    if (m) {
      const label = m[1];
      const cls = /ตัวอย่าง|ลองคิด|example/i.test(label) ? "ex" : /ระวัง|พลาด|กับดัก/.test(label) ? "trap-p" : /จำ/.test(label) ? "memo-p" : "";
      if (cls) return `<p class="callout ${cls}">${inline(b)}</p>`;
    }
    return `<p>${inline(b)}</p>`;
  }).join("");
}
function visual(v) {
  if (!v) return "";
  const node = n => `<div class="vn"><b>${esc(n.title)}</b>${n.text ? `<span>${esc(n.text)}</span>` : ""}</div>`;
  let body;
  if (v.kind === "flow") body = `<div class="v-flow">${v.nodes.map(node).join("")}</div>`;
  else if (v.kind === "tree") body = `<div class="v-tree"><div class="vn root"><b>${esc(v.title)}</b></div><div class="stem"></div><div class="branches">${v.nodes.map(node).join("")}</div></div>`;
  else if (v.kind === "formula") body = `<div class="v-formula">${v.nodes.map(node).join("")}</div>`;
  else if (v.kind === "timeline") body = `<div class="v-timeline">${v.nodes.map(node).join("")}</div>`;
  else body = `<div class="v-compare">${v.nodes.map(node).join("")}</div>`;
  return `<section class="stack" aria-label="ภาพสรุป">
    <div class="overview-label">มองภาพรวมก่อนจำ · ${esc(v.title)}</div>${body}
    <div class="memo-row">
      ${v.memory ? `<div class="memo"><b>★ จำให้ติด</b>${esc(v.memory)}</div>` : ""}
      ${v.trap ? `<div class="trap"><b>! ระวังจุดนี้</b>${esc(v.trap)}</div>` : ""}
    </div></section>`;
}

function localStore(key) {
  return {
    load() { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
    save(state) { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} },
  };
}

function mount(root, D, opts = {}) {
  const store = opts.store || localStore("exam-prep:" + D.id);
  const MASCOT = opts.mascot || D.mascot || "";
  const M = D.meta;
  const NDAYS = D.plan.length;
  const MOCKS = D.mock.count;
  const LIMIT = D.mock.minutes * 60 * 1000;
  const PARTS = (D.scoring && D.scoring.parts) || [];

  const SUBJ = D.subjects, SK = {};
  SUBJ.forEach((s, i) => { s.i = i; SK[s.key] = s; SK[s.code] = s; });
  const Q = {};
  for (const s of SUBJ) for (const r of D.questions[s.key])
    Q[r[0]] = { id: r[0], topic: r[1], stem: r[2], opts: r[3], ans: r[4], ex: r[5], src: r[6], s };
  const TOTAL_Q = Object.keys(Q).length;
  const MOCK_Q = SUBJ.reduce((n, s) => n + s.perSet, 0);
  const PRACTICE_Q = SUBJ.reduce((n, s) => n + s.practice, 0);
  const MOCK_DAY = {}, ANALYZE_DAY = {};
  D.plan.forEach(p => { if (p.kind === "mock") MOCK_DAY[p.mock] = p.day; if (p.kind === "analyze") ANALYZE_DAY[p.mock] = p.day; });
  const WEAK_DAY = (D.plan.find(p => p.kind === "repair" && p.variant === "weak") || {}).day;
  const STUDY_DAYS = D.plan.filter(p => p.kind === "study").length;
  const MOCK_LIST = Array.from({ length: MOCKS }, (_, i) => i + 1);

  const pid = (s, n) => s.code + String(n).padStart(3, "0");
  const span = (a, b) => { const s = SK[a[0]], out = []; for (let n = +a.slice(1); n <= +b.slice(1); n++) out.push(pid(s, n)); return out; };
  const practiceIds = s => Array.from({ length: s.practice }, (_, j) => pid(s, j + 1));
  const mockIds = k => SUBJ.flatMap(s => Array.from({ length: s.perSet }, (_, j) => pid(s, s.practice + (k - 1) * s.perSet + j + 1)));
  const isMockId = id => +id.slice(1) > Q[id].s.practice;

  /* ---------- state ---------- */
  const blank = () => ({ start: null, exam: null, att: {}, days: {}, mocks: {}, run: null, read: {} });
  let S = (() => { const v = store.load(); return v && typeof v === "object" ? Object.assign(blank(), v) : blank(); })();
  function save() { S.updatedAt = Date.now(); store.save(S); }
  if (!S.start) { S.start = isoDate(today0()); save(); }
  const examAt = () => S.exam ? new Date(S.exam + "T" + (M.examTime || "09:00") + ":00+07:00") : M.examAt ? new Date(M.examAt) : null;
  const planDayRaw = () => Math.floor((today0() - parseIso(S.start)) / DAY) + 1;
  const planDay = () => Math.min(NDAYS, Math.max(1, planDayRaw()));
  const dayDate = n => parseIso(S.start) + (n - 1) * DAY;

  function record(id, choice) {
    const q = Q[id], ok = choice === q.ans;
    const a = S.att[id] || (S.att[id] = { n: 0, c: 0 });
    a.n++; if (ok) a.c++; a.ch = choice; a.ok = ok; a.t = Date.now();
    if (!ok) { a.box = 1; a.due = dueIn(1); }
    else if (a.box) {
      a.box++;
      if (a.box > 3 && !a.flag) { delete a.box; delete a.due; delete a.why; }
      else a.due = dueIn(a.box >= 3 ? 7 : 3);
    }
    return ok;
  }
  function setFlag(id, on) {
    const a = S.att[id]; if (!a) return;
    if (on) { a.flag = 1; a.why = a.why || "เดาถูกแต่ไม่มั่นใจ"; if (!a.box) { a.box = 1; a.due = dueIn(1); } }
    else { delete a.flag; if (a.ok && a.box === 1) { delete a.box; delete a.due; delete a.why; } }
    save();
  }
  const dueList = () => Object.keys(S.att).filter(id => Q[id] && S.att[id].box && S.att[id].due <= Date.now());
  const notebook = () => Object.keys(S.att).filter(id => Q[id] && S.att[id].box);

  function stats(list) {
    let done = 0, ok = 0;
    for (const id of list) { const a = S.att[id]; if (a) { done++; if (a.ok) ok++; } }
    return { total: list.length, done, ok, acc: done ? Math.round(ok / done * 100) : null };
  }
  function topicStats() {
    const m = {};
    for (const id in S.att) {
      const q = Q[id]; if (!q) continue;
      const k = q.s.key + "|" + q.topic, t = m[k] || (m[k] = { s: q.s, topic: q.topic, done: 0, ok: 0 });
      t.done++; if (S.att[id].ok) t.ok++;
    }
    return Object.values(m).map(t => ({ ...t, acc: t.ok / t.done }));
  }
  const weakTopics = (n = 5) => topicStats().filter(t => t.done >= 3).sort((a, b) => a.acc - b.acc || b.done - a.done).slice(0, n);

  /* scoring parts, e.g. ภาคทั่วไป / ภาคเฉพาะ each needing 60% */
  function partResults(r) {
    return PARTS.map(p => {
      const subs = p.subjects.map(c => SK[c]);
      const got = subs.reduce((n, s) => n + ((r.by[s.key] || [0])[0]), 0);
      const max = subs.reduce((n, s) => n + s.perSet, 0);
      const need = Math.ceil(max * p.pass - 1e-9);
      return { name: p.name, got, max, need, pass: got >= need, subs };
    });
  }
  function partsBlock(r) {
    if (!PARTS.length) return "";
    const res = partResults(r), all = res.every(x => x.pass);
    return `<div class="stack" style="gap:8px"><div class="parts">${res.map(x => `<div class="part ${x.pass ? "pass" : "fail"}">
      <span class="small">${esc(x.name)} <span class="muted">(${x.subs.map(s => esc(s.short)).join(" ")})</span></span>
      <b class="num">${x.got}<span class="muted" style="font-size:15px"> / ${x.max}</span></b>
      <span class="verdict">${x.pass ? "✓ ถึงเกณฑ์" : `ยังขาด ${x.need - x.got} คะแนน`} · ขั้นต่ำ ${x.need}</span></div>`).join("")}</div>
      <p class="small ${all ? "" : "trap"}" style="${all ? "" : "padding:8px 12px"}">${all ? "ถึงเกณฑ์ขั้นต่ำทุกภาคในชุดนี้ ยังต้องแข่งลำดับคะแนนจริง จึงตั้งเป้าให้สูงกว่าเส้นขั้นต่ำ" : "ต้องผ่านทุกภาคแยกกัน คะแนนรวมสูงไม่ชดเชยภาคที่ไม่ถึงเกณฑ์"}</p></div>`;
  }

  /* ---------- navigation ---------- */
  const NAV = [["home", "หน้าหลัก"], ["plan", `แผน ${NDAYS} วัน`], ["notes", "สรุปบทเรียน"], ["practice", "ฝึกโจทย์"], ["mock", "ข้อสอบจำลอง"], ["review", "สมุดข้อผิด"]];
  root.classList.add("exam-prep");
  root.innerHTML = `<header class="topbar"><div class="topbar-in">
      <a class="brand" href="#home" aria-label="หน้าหลัก"><span class="brand-30">${esc(M.brandBig)}</span><span class="brand-t">${esc(M.brandAfter)}<small>${esc(M.brandSub)}</small></span></a>
      <nav class="nav" data-ep="nav" aria-label="เมนูหลัก"></nav></div></header>
    <main class="ep-main" data-ep="app" tabindex="-1"></main>`;
  const $ = k => root.querySelector(`[data-ep="${k}"]`);
  const byId = id => root.querySelector("#" + id);

  function renderNav(view) {
    const due = dueList().length;
    $("nav").innerHTML = NAV.map(([k, label]) =>
      `<a href="#${k}" ${view === k ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg><span>${label}</span>${k === "review" && due ? `<span class="badge num">${due}</span>` : ""}</a>`).join("");
  }

  let quiz = null, tick = null, confirmOpen = false, pFilter = null, rvFilter = "all";
  function go(h) { if (location.hash === "#" + h) render(); else location.hash = h; }

  function render(keep) {
    clearInterval(tick); tick = null;
    const h = (location.hash || "#home").slice(1);
    const [view, a, b, c] = h.split("-");
    const V = {
      home: viewHome, plan: viewPlan, day: () => viewDay(+a, b, c), notes: () => viewNotes(a, b), practice: () => viewPractice(a),
      quiz: viewQuiz, mock: () => viewMock(+a, b), review: viewReview, guide: viewGuide,
    };
    const fn = V[view] || viewHome;
    const navKey = view === "day" ? "plan" : view === "quiz" ? (quiz && quiz.nav) || "practice" : view === "guide" ? "home" : V[view] ? view : "home";
    renderNav(navKey);
    $("app").innerHTML = fn();
    if (view === "mock" && S.run && S.run.set === +a && b !== "result") startTimer();
    if (!keep && (view === "quiz" || !(view === "mock" && b === undefined))) window.scrollTo(0, 0);
  }

  /* ---------- views: home ---------- */
  function countdown() {
    const ex = examAt();
    const daysLeft = ex ? Math.ceil((ex.getTime() - today0()) / DAY) : null;
    if (daysLeft === null || daysLeft < 0) {
      return `<div class="stamp off" role="note"><span class="t">วันสอบของคุณ</span><b class="num" style="font-size:28px">ยังไม่ตั้ง</b>
        <small>${ex ? "กำหนดสอบที่อ้างอิงผ่านไปแล้ว " : ""}ใส่วันสอบตามประกาศรอบที่สมัครได้ที่<a href="#plan">หน้าแผน</a> แล้วระบบจะนับถอยหลังให้</small></div>`;
    }
    return `<div class="stamp" role="note">
      <span class="t">อีก</span><b class="num">${daysLeft} วัน</b>
      <span class="t">ถึงวันสอบข้อเขียน</span>
      <small>${thDate(ex, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${S.exam ? "· วันที่คุณตั้งไว้" : esc(M.examNote || "")}</small>
    </div>`;
  }
  function viewHome() {
    const n = planDay(), raw = planDayRaw(), p = D.plan[n - 1];
    const st = stats(Object.keys(Q)), due = dueList().length;
    const lastMock = Object.entries(S.mocks).flatMap(([k, arr]) => arr.map(r => ({ k, ...r }))).sort((x, y) => y.at - x.at)[0];
    const weak = weakTopics(5);
    return `
    <section class="hero">
      <span class="hero-pill">${esc(M.heroPill)}</span>
      ${MASCOT ? `<img class="mascot" src="${MASCOT}" alt="ตัวการ์ตูนตำรวจถือแฟ้มเอกสาร" width="133" height="171">` : ""}
      <div class="hero-title"><span class="big30">${esc(M.brandBig)}</span><span class="after">${esc(M.brandAfter)}</span></div>
      <div class="band">${esc(M.band)}<small>${esc(M.bandSmall)}</small></div>
      <div class="chips">${SUBJ.map(s => `<a class="chip subj s-${s.key}" href="#notes-${s.key}">${esc(s.short)}</a>`).join("")}</div>
    </section>

    <section class="today">
      <div class="card today-main taped">
        <div class="row" style="justify-content:space-between">
          <div class="daynum"><b class="num">วันที่ ${n}</b><span>จาก ${NDAYS} · ${thDate(today0(), { weekday: "long", day: "numeric", month: "long" })}</span></div>
          ${raw < 1 ? `<span class="chip">แผนเริ่ม ${thDate(parseIso(S.start))}</span>` : raw > NDAYS ? `<span class="chip">ครบแผน ${NDAYS} วันแล้ว</span>` : ""}
        </div>
        <h3>${esc(p.read)}</h3>
        <p class="muted">${esc(p.target)}</p>
        ${p.ranges.length ? `<div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><b style="font-family:var(--f-display)">ความคืบหน้าวันนี้</b><b class="num" style="font-family:var(--f-display);font-size:20px">${dayPct(p)}%</b></div>${segBar(p)}</div>` : ""}
        <div class="row">
          <a class="btn primary" href="#day-${n}">เปิดงานของวันนี้</a>
          ${due ? `<button class="btn" data-act="review-due">ทบทวนข้อครบรอบ ${due} ข้อ</button>` : ""}
          <a class="btn ghost" href="#plan">ดูแผนทั้งหมด</a>
        </div>
      </div>
      ${countdown()}
    </section>

    <section class="stats">
      <div class="card stat"><b class="num">${fmtN(st.done)}<small class="muted" style="font-size:16px"> / ${fmtN(TOTAL_Q)}</small></b><span>ข้อที่ทำแล้ว</span></div>
      <div class="card stat"><b class="num">${st.acc === null ? "–" : st.acc + "%"}</b><span>ตอบถูกล่าสุด</span></div>
      <div class="card stat"><b class="num">${due}</b><span>ข้อรอทบทวนวันนี้</span></div>
      <div class="card stat"><b class="num">${lastMock ? lastMock.score + `<small class='muted' style='font-size:16px'> / ${MOCK_Q}</small>` : "–"}</b><span>${lastMock ? "จำลองชุด " + lastMock.k + " ล่าสุด" : "ยังไม่ได้ทำชุดจำลอง"}</span></div>
    </section>

    <section class="stack">
      <div class="sec-title"><h2>${SUBJ.length} วิชา ตามสัดส่วนข้อสอบ ${MOCK_Q} ข้อ</h2><a class="more" href="#guide">${esc(M.guideTitle)}</a></div>
      <div class="grid g3">${SUBJ.map(subjCard).join("")}</div>
    </section>

    <section class="grid g2">
      <div class="card stack">
        <h2 style="font-size:20px">หัวข้อที่ควรซ่อมก่อน</h2>
        ${weak.length ? `<ul class="plain weak">${weak.map(t => `<li class="s-${t.s.key}"><span>${subjChip(t.s)} ${esc(t.topic)}</span><span class="num small">${t.ok}/${t.done} ถูก</span>${bar(t.acc * 100)}<button class="btn sm" data-act="topic" data-s="${t.s.key}" data-topic="${esc(t.topic)}">ฝึกซ้ำ</button></li>`).join("")}</ul>`
          : `<p class="muted">เมื่อทำแต่ละหัวข้อครบ 3 ข้อขึ้นไป หัวข้อที่อัตราถูกต่ำสุดจะขึ้นที่นี่${WEAK_DAY ? ` ใช้เลือกหัวข้อซ่อมในวันที่ ${WEAK_DAY}` : ""}</p>`}
      </div>
      <div class="card stack">
        <h2 style="font-size:20px">วันจำลองสอบ ${D.mock.minutes} นาที</h2>
        <p class="muted small">${esc(M.mockTip)}</p>
        <div class="timeline" style="grid-template-columns:repeat(${Math.min(MOCKS, 4)},minmax(0,1fr))">${MOCK_LIST.map(k => { const r = (S.mocks[k] || []).slice(-1)[0]; return `<div><b class="num">ชุด ${k}</b>${r ? `<span class="num">${r.score}/${MOCK_Q}</span>` : `<span class="muted">วันที่ ${MOCK_DAY[k] || "-"}</span>`}</div>`; }).join("")}</div>
        <div class="row"><a class="btn" href="#mock">ไปที่ข้อสอบจำลอง</a></div>
      </div>
    </section>`;
  }
  function subjCard(s) {
    const pr = stats(practiceIds(s));
    return `<div class="card subj-card s-${s.key}">
      <div class="row" style="justify-content:space-between"><h3>${esc(s.name)}</h3><span class="code">${s.code}</span></div>
      <div class="meta"><span>${s.perSet} ข้อต่อชุดสอบ · ${s.chapters.length} บท</span><span class="num">${pr.done}/${pr.total}</span></div>
      ${bar2(pr)}
      <div class="row"><a class="btn sm" href="#notes-${s.key}">อ่านสรุป</a><a class="btn sm" href="#practice-${s.key}">ฝึกโจทย์</a>${pr.acc !== null ? `<span class="muted small num" style="margin-left:auto">ถูก ${pr.acc}%</span>` : ""}</div>
    </div>`;
  }

  /* ---------- views: plan & day ---------- */
  const readKey = (s, n) => s.key + "-" + n;
  function dayParts(p) {
    return p.ranges.map(([a, b]) => { const s = SK[a[0]], ids = span(a, b); return { s, a, b, ids, chs: chaptersForIds(ids).map(c => c.n) }; });
  }
  function daySteps(p) {
    return dayParts(p).flatMap(x => {
      const st = stats(x.ids), read = x.chs.filter(n => S.read[readKey(x.s, n)]).length;
      return [
        ...(x.chs.length ? [{ s: x.s, label: "ทบทวน" + x.s.short, f: read / x.chs.length, txt: `${read}/${x.chs.length} บท` }] : []),
        { s: x.s, label: "ฝึก" + x.s.short, f: st.done / st.total, txt: `${st.done}/${st.total} ข้อ` },
      ];
    });
  }
  function dayPct(p) { const st = daySteps(p); return st.length ? Math.floor(st.reduce((n, x) => n + x.f, 0) / st.length * 100) : 0; }
  function segBar(p, labels = true) {
    const st = daySteps(p);
    return `<div class="segbar" role="img" aria-label="ความคืบหน้า ${dayPct(p)}%">${st.map(x => `<span class="seg s-${x.s.key}"><i style="width:${x.f * 100}%"></i></span>`).join("")}</div>
      ${labels ? `<div class="seg-labels">${st.map(x => `<span class="${x.f >= 1 ? "ok" : ""}"><b>${x.f >= 1 ? "✓ " : ""}${esc(x.label)}</b><span class="num">${x.txt}</span></span>`).join("")}</div>` : ""}`;
  }
  function dayDone(p) {
    if (S.days[p.day]) return true;
    if (p.ranges.length) return dayPct(p) === 100;
    if (p.kind === "mock") return !!(S.mocks[p.mock] || []).length;
    return false;
  }
  function viewPlan() {
    const n = planDayRaw();
    const card = p => {
      const done = dayDone(p), isT = p.day === n;
      return `<a class="day k-${p.kind} ${isT ? "is-today" : ""}" href="#day-${p.day}">
        ${done ? `<span class="check" aria-label="เสร็จแล้ว">✓</span>` : `<span class="tag">${isT ? "วันนี้" : thDate(dayDate(p.day))}</span>`}
        <span class="dn num">${p.day}</span>
        <span class="eyebrow" style="font-size:11.5px">${KIND[p.kind]}</span>
        <span class="read">${esc(p.read)}</span>${p.ranges.length ? `<div style="margin-top:auto">${segBar(p, false)}</div>` : ""}</a>`;
    };
    const doneCount = D.plan.filter(dayDone).length;
    const phases = D.phases && D.phases.length ? D.phases : [{ from: 1, to: NDAYS, label: "" }];
    return `
    <div class="page-head">
      <h1>แผน ${NDAYS} วัน</h1>
    </div>
    <div class="card row" style="justify-content:space-between">
      <label class="row" for="start-date"><span>เริ่มแผนวันที่</span><input class="date-in" type="date" id="start-date" value="${S.start}"></label>
      <span class="muted num">เสร็จแล้ว ${doneCount}/${NDAYS} วัน · วันสุดท้ายของแผน ${thDate(dayDate(NDAYS), { day: "numeric", month: "long", year: "numeric" })}</span>
    </div>
    <div class="plan-grid">
      ${phases.map(ph => `${ph.label ? `<div class="phase-label">${esc(ph.label)}</div>` : ""}${D.plan.slice(ph.from - 1, ph.to).map(card).join("")}`).join("")}
    </div>`;
  }

  function chaptersForIds(list) {
    const seen = new Map();
    for (const id of list) {
      const q = Q[id];
      for (const n of q.s.topicMap[q.topic] || []) {
        const k = q.s.key + "-" + n;
        if (!seen.has(k)) seen.set(k, { s: q.s, n });
      }
    }
    return [...seen.values()].sort((a, b) => a.s.i - b.s.i || a.n - b.n);
  }
  function chLink(s, n) {
    const ch = s.chapters.find(c => c.n === n);
    return `<a class="ch-item s-${s.key}" href="#notes-${s.key}-${n}"><span class="badge-n">${n}</span><span>${esc(ch.title)}<small>${esc(s.short)}${ch.visual ? " · " + esc(ch.visual.title) : ""}</small></span></a>`;
  }
  function mockDayCard(k) {
    const r = (S.mocks[k] || []).slice(-1)[0];
    return `<div class="card stack" style="background:var(--rose-soft);border-color:transparent">
      <h2 style="font-size:22px">ข้อสอบจำลอง ชุดที่ ${k} · ${MOCK_Q} ข้อ · ${D.mock.minutes} นาที</h2>
      <p>ทำโดยไม่เปิดเฉลยและไม่ใช้เครื่องคิดเลข ตรวจคำตอบหลังจบแล้วบันทึกคะแนนทันที${ANALYZE_DAY[k] ? " ส่วนการวิเคราะห์เชิงลึกให้ทำวันถัดไป" : " แล้วอ่านเฉลยข้อผิดและข้อที่เดา"}</p>
      <div class="row"><a class="btn primary" href="#mock-${k}">${S.run && S.run.set === k ? "ทำต่อ" : r ? "ดูชุดนี้" : "เริ่มจับเวลา"}</a>${r ? `<a class="btn" href="#mock-${k}-result">ผลล่าสุด ${r.score}/${MOCK_Q}</a>` : ""}</div>
    </div>`;
  }
  function viewDay(n, key, part) {
    if (!(n >= 1 && n <= NDAYS)) n = planDay();
    const p = D.plan[n - 1], done = dayDone(p);
    let body = "";
    if (p.kind === "study") {
      const items = dayItems(p, n);
      const sel = items.find(it => it.ref === `${key}-${part}`) || items.find(it => !it.done) || items[0];
      body = `${dayTimeline()}<div class="day-shell">${dayNav(p, n, items, sel)}<section class="pane s-${sel.x.s.key}" aria-live="polite">${sel.ex ? exPane(sel, items, n) : lessonPane(sel, items, n)}</section></div>`;
    } else if (p.kind === "mock") {
      body = mockDayCard(p.mock);
    } else if (p.kind === "analyze") {
      const k = p.mock, r = (S.mocks[k] || []).slice(-1)[0];
      body = r ? `<div class="card stack"><h2 style="font-size:20px">ผลจำลองชุด ${k}: ${r.score}/${MOCK_Q}</h2>${partsBlock(r)}${mockBySubject(r)}
          <div class="row"><a class="btn primary" href="#mock-${k}-result">วิเคราะห์ข้อผิดรายข้อ</a><button class="btn" data-act="mock-wrong" data-k="${k}">ทำข้อผิดของชุดนี้ใหม่</button></div></div>`
        : `<div class="card empty"><p>ยังไม่มีผลจำลองชุด ${k}</p><a class="btn" href="#mock-${k}">ไปทำชุด ${k}</a></div>`;
    } else if (p.kind === "repair" && p.variant === "weak") {
      const w = weakTopics(2);
      body = `<div class="card stack"><h2 style="font-size:20px">2 หัวข้อที่อัตราถูกต่ำสุดของคุณ</h2>
        ${w.length ? `<ul class="plain weak">${w.map(t => `<li class="s-${t.s.key}"><span>${subjChip(t.s)} ${esc(t.topic)}</span><span class="num small">${t.ok}/${t.done} ถูก</span>${bar(t.acc * 100)}<button class="btn sm primary" data-act="topic-wrong" data-s="${t.s.key}" data-topic="${esc(t.topic)}">ทำข้อที่เคยผิด</button></li>`).join("")}</ul>
          <div class="ch-list">${chaptersForIds(w.flatMap(t => Object.keys(Q).filter(id => Q[id].s === t.s && Q[id].topic === t.topic).slice(0, 1))).map(c => chLink(c.s, c.n)).join("")}</div>`
          : `<p class="muted">ยังมีข้อมูลไม่พอ ทำแบบฝึกวัน 1-${STUDY_DAYS} ก่อน แล้วหัวข้อที่ต้องซ่อมจะแสดงที่นี่</p>`}
        <p class="muted small">ทำข้อที่เคยผิดซ้ำโดยปิดเฉลย แล้วเขียนหลักคิดใหม่ด้วยคำของตัวเอง</p></div>`;
    } else if (p.kind === "repair") {
      body = `<div class="card stack"><h2 style="font-size:20px">ปิดหนังสือ สรุป ${SUBJ.length} วิชาอย่างละหนึ่งหน้า</h2>
        <p class="muted">ทวนสูตร คำศัพท์ ตารางเปรียบเทียบ และข้อมูลที่เปลี่ยนแปลง แล้วเปิดตารางสรุปท้ายบทเพื่อตรวจสิ่งที่ลืม</p>
        <div class="ch-list">${SUBJ.map(s => s.extras.length
          ? `<a class="ch-item s-${s.key}" href="#notes-${s.key}-x1"><span class="badge-n">★</span><span>${esc(s.extras[0].title)}<small>${esc(s.short)}</small></span></a>`
          : chLink(s, s.chapters[s.chapters.length - 1].n)).join("")}</div></div>`;
    } else {
      const k = p.mock || MOCKS, g = M.finalGuide && D.guide.find(x => x.title.startsWith(M.finalGuide));
      body = `<div class="card stack"><h2 style="font-size:20px">ไม่เริ่มหัวข้อใหญ่ใหม่ ทวนข้อผิดชุด ${k} กับสรุปส่วนตัว</h2>
        <div class="row"><a class="btn primary" href="#review">เปิดสมุดข้อผิด</a><a class="btn" href="#mock-${k}-result">ข้อผิดชุด ${k}</a></div></div>
        ${g ? `<div class="card taped stack"><h2 style="font-size:20px">${esc(g.title)}</h2><div class="prose">${md(g.md)}</div></div>` : ""}`;
    }
    return `
    <div class="crumb"><a href="#plan">แผน ${NDAYS} วัน</a> / <span>วันที่ ${n}</span></div>
    <div class="page-head">
      <span class="eyebrow">${KIND[p.kind]} · ${thDate(dayDate(n), { weekday: "long", day: "numeric", month: "long" })}</span>
      <h1>วันที่ ${n} · ${esc(p.read)}</h1>
      <p>${esc(p.target)}</p>
    </div>
    ${body}
    <div class="card row" style="justify-content:space-between">
      <label class="row" for="day-done"><input type="checkbox" id="day-done" data-day="${n}" ${S.days[n] ? "checked" : ""}> ทำเครื่องหมายว่าวันนี้เสร็จแล้ว ${done && !S.days[n] ? '<span class="muted small">(ระบบนับว่าครบแล้ว)</span>' : ""}</label>
      <div class="row">${n > 1 ? `<a class="btn sm" href="#day-${n - 1}">← วันที่ ${n - 1}</a>` : ""}${n < NDAYS ? `<a class="btn sm" href="#day-${n + 1}">วันที่ ${n + 1} →</a>` : ""}</div>
    </div>`;
  }
  function dayItems(p, n) {
    return dayParts(p).flatMap((x, i) => [
      ...x.chs.map((c, j) => ({ x, i, n: c, j, ref: `${x.s.key}-${c}`, href: `day-${n}-${x.s.key}-${c}`, done: !!S.read[readKey(x.s, c)] })),
      { x, i, ex: true, ref: `${x.s.key}-ex`, href: `day-${n}-${x.s.key}-ex`, done: stats(x.ids).done === x.ids.length },
    ]);
  }
  function itemTitle(it) { return it.ex ? `แบบฝึก ${it.x.a}–${it.x.b}` : it.x.s.chapters.find(c => c.n === it.n).title; }
  function dayNav(p, n, items, sel) {
    const pct = dayPct(p);
    const groups = dayParts(p).map((x, i) => {
      const mine = items.filter(it => it.i === i), read = mine.filter(it => !it.ex && it.done).length;
      return `<div class="dnav-group s-${x.s.key}">
        <div class="g-head"><span class="step-n sm">${i + 1}</span>${esc(x.s.name)}<span class="num">${read}/${x.chs.length} บท</span></div>
        ${x.chs.length ? `<div class="g-sub">ทบทวนความรู้</div>` : ""}
        ${mine.map(it => {
          const st = it.ex ? stats(it.x.ids) : null;
          return `${it.ex ? `<div class="g-sub">แบบฝึก</div>` : ""}<a class="dnav-item ${it === sel ? "cur" : ""} ${it.done ? "done" : ""}" href="#${it.href}" ${it === sel ? 'aria-current="true"' : ""}>
            <span class="dot">${it.done ? "✓" : it.ex ? "✎" : it.n}</span><span class="t">${esc(itemTitle(it))}</span>
            ${it.ex ? `<span class="mini">${bar2(st)}<small class="num">${st.done}/${st.total} ข้อ${st.acc !== null ? ` · ถูก ${st.acc}%` : ""}</small></span>` : ""}</a>`;
        }).join("")}
      </div>`;
    }).join("");
    return `<details class="card dnav" ${innerWidth > 900 ? "open" : ""}>
      <summary>
        <span class="row" style="justify-content:space-between"><span class="pct num">${pct}%</span><span class="muted small">${pct === 100 ? "ครบทุกภารกิจแล้ว" : "ภารกิจวันนี้"}</span></span>
        ${segBar(p, false)}
        <span class="cur-name small"><span class="muted">กำลังเปิด:</span> ${esc(itemTitle(sel))} <span class="chev" aria-hidden="true">▾</span></span>
      </summary>
      <div class="dnav-body">${groups}</div>
    </details>`;
  }
  function paneFoot(sel, items, center) {
    const k = items.indexOf(sel), prev = items[k - 1], next = items[k + 1];
    return `<div class="pane-foot">
      ${prev ? `<a class="btn" href="#${prev.href}">← ${esc(itemTitle(prev).split(":")[0])}</a>` : "<span></span>"}
      <div class="row">${center}${next && !center ? `<a class="btn primary" href="#${next.href}">ถัดไป: ${esc(itemTitle(next).split(":")[0])} →</a>` : ""}</div>
    </div>`;
  }
  function lessonPane(sel, items) {
    const s = sel.x.s, ch = s.chapters.find(c => c.n === sel.n), k = readKey(s, sel.n);
    const next = items[items.indexOf(sel) + 1];
    const action = sel.done
      ? `<button class="btn ghost sm" data-act="read" data-k="${k}">ยกเลิกอ่านแล้ว</button>${next ? `<a class="btn primary" href="#${next.href}">ถัดไป →</a>` : ""}`
      : `<button class="btn primary" data-act="read" data-k="${k}" ${next ? `data-next="${next.href}"` : ""}>อ่านจบแล้ว ✓${next ? " ไปต่อ →" : ""}</button>`;
    return `<div class="pane-head">${subjChip(s)}<span class="muted small">ภารกิจ ${sel.i + 1} · ทบทวนความรู้ บทที่ ${sel.j + 1} จาก ${sel.x.chs.length}</span>${sel.done ? '<span class="chip" style="background:var(--sage-soft);color:var(--sage)">✓ อ่านแล้ว</span>' : ""}</div>
      <div class="ch-head"><span class="badge-n">${ch.n}</span><h1>${esc(ch.title)}</h1></div>
      ${visual(ch.visual)}
      <article class="card prose">${md(ch.md)}</article>
      ${ch.svg ? `<figure class="art" style="margin:0" aria-label="ภาพประกอบ">${ch.svg}</figure>` : ""}
      ${paneFoot(sel, items, action)}`;
  }
  function exPane(sel, items, n) {
    const { s, a, b, ids } = sel.x, st = stats(ids);
    const unread = items.filter(it => it.i === sel.i && !it.ex && !it.done);
    return `<div class="pane-head">${subjChip(s)}<span class="muted small">ภารกิจ ${sel.i + 1} · แบบฝึก ${ids.length} ข้อ</span></div>
      <div class="ch-head"><span class="badge-n">✎</span><h1>แบบฝึก${esc(s.name)} ${a}–${b}</h1></div>
      <div class="card stack" style="gap:14px">
        <div class="row" style="justify-content:space-between;align-items:baseline"><span class="score-big num" style="font-size:44px">${st.done}<span class="muted" style="font-size:22px"> / ${st.total} ข้อ</span></span><span class="muted num">${st.acc !== null ? `ถูก ${st.ok} ข้อ (${st.acc}%)` : "ยังไม่ได้เริ่ม"}</span></div>
        ${bar2(st, "lg")}
        ${unread.length ? `<p class="small trap">ยังไม่ได้อ่าน ${unread.map(it => `<a href="#${it.href}">บท ${it.n}</a>`).join(", ")} แนะนำให้ทบทวนก่อนฝึก</p>` : ""}
        <div class="row"><button class="btn primary" data-act="range" data-a="${a}" data-b="${b}" data-day="${n}">${st.done ? (st.done === st.total ? "ทำซ้ำชุดนี้" : "ทำต่อ") : "เริ่มทำแบบฝึก"}</button><span class="muted small">ทำโดยไม่เปิดเฉลย ข้อที่ลังเลให้กดทำเครื่องหมายไว้</span></div>
      </div>
      ${paneFoot(sel, items, "")}`;
  }
  function dayTimeline() {
    const t = D.dayTiming;
    if (!t) return "";
    return `<section class="card stack"><h2 style="font-size:18px">${esc(t.title)}</h2>
      <div class="timeline">${t.steps.map(([time, label]) => `<div><b class="num">${esc(time)}</b>${esc(label)}</div>`).join("")}</div>
      ${t.note ? `<p class="muted small">${esc(t.note)}</p>` : ""}</section>`;
  }

  /* ---------- views: notes ---------- */
  function viewNotes(key, part) {
    const s = SK[key];
    if (!s) {
      return `<div class="page-head"><span class="eyebrow">Visual notes · ${SUBJ.length} วิชา ${SUBJ.reduce((n, s) => n + s.chapters.length, 0)} บท</span><h1>สรุปบทเรียน</h1><p>อ่านภาพสรุปก่อน แล้วปิดหน้าจออธิบายด้วยคำของตัวเอง ถ้าอธิบายไม่ได้ให้กลับไปดูตัวอย่าง</p></div>
        <div class="grid g3">${SUBJ.map(s => `<a class="card subj-card s-${s.key}" href="#notes-${s.key}" style="text-decoration:none;color:inherit"><div class="row" style="justify-content:space-between"><h3>${esc(s.name)}</h3><span class="code">${s.code}</span></div><p class="muted small">${s.chapters.length} บท · ${s.chapters.filter(c => c.visual).length} ภาพสรุป</p><p class="small">${s.chapters.slice(0, 4).map(c => esc(c.title.split(":")[0])).join(" · ")} …</p></a>`).join("")}</div>`;
    }
    const tabs = `<div class="subj-tabs">${SUBJ.map(x => `<a class="chip subj s-${x.key} ${x === s ? "on" : ""}" href="#notes-${x.key}">${esc(x.short)}</a>`).join("")}</div>`;
    if (!part) {
      return `${tabs}<div class="page-head"><span class="eyebrow">Visual notes / ${s.key}</span><h1>${esc(s.name)}</h1></div>
        <div class="ch-list s-${s.key}">${s.chapters.map(c => chLink(s, c.n)).join("")}
        ${s.extras.map((x, i) => `<a class="ch-item s-${s.key}" href="#notes-${s.key}-x${i + 1}"><span class="badge-n">★</span><span>${esc(x.title)}<small>ทบทวนท้ายบท</small></span></a>`).join("")}</div>`;
    }
    const isX = part[0] === "x";
    const list = [...s.chapters.map(c => ({ ...c, ref: String(c.n) })), ...s.extras.map((x, i) => ({ ...x, ref: "x" + (i + 1) }))];
    const idx = list.findIndex(c => c.ref === part);
    const ch = list[idx];
    if (!ch) return viewNotes(key);
    const prev = list[idx - 1], next = list[idx + 1];
    const qs = isX ? [] : practiceIds(s).filter(id => (s.topicMap[Q[id].topic] || []).includes(ch.n));
    const st = stats(qs);
    return `<div class="s-${s.key} stack" style="gap:22px">
      <span class="sidetab">${s.key.toUpperCase()}</span>
      <div class="crumb"><a href="#notes">สรุปบทเรียน</a> / <a href="#notes-${s.key}">${esc(s.name)}</a></div>
      <div class="notes-top"><span>Visual notes / ${s.key}</span><span>อ่าน • เชื่อม • จำ • ลองทำ</span></div>
      <div class="ch-head"><span class="badge-n">${isX ? "★" : ch.n}</span><h1>${esc(ch.title)}</h1></div>
      ${visual(ch.visual)}
      <article class="card prose">${md(ch.md)}</article>
      ${ch.svg ? `<figure class="art" style="margin:0" aria-label="ภาพประกอบ">${ch.svg}</figure>` : ""}
      ${qs.length ? `<div class="card row" style="justify-content:space-between"><div class="stack" style="gap:6px;flex:1;min-width:200px"><b style="font-family:var(--f-display)">ฝึกโจทย์หัวข้อนี้ ${qs.length} ข้อ</b>${bar2(st)}</div><button class="btn primary" data-act="chapter" data-s="${s.key}" data-n="${ch.n}">${st.done ? "ฝึกอีกรอบ" : "เริ่มฝึก"}</button></div>` : ""}
      ${isX ? "" : `<div class="row"><button class="btn ${S.read[readKey(s, ch.n)] ? "" : "primary"}" data-act="read" data-k="${readKey(s, ch.n)}">${S.read[readKey(s, ch.n)] ? "✓ อ่านบทนี้แล้ว (กดเพื่อยกเลิก)" : "อ่านจบแล้ว ✓"}</button></div>`}
      <div class="pager">${prev ? `<a class="btn" href="#notes-${s.key}-${prev.ref}">← ${esc(prev.title.split(":")[0])}</a>` : "<span></span>"}${next ? `<a class="btn" href="#notes-${s.key}-${next.ref}">${esc(next.title.split(":")[0])} →</a>` : ""}</div>
    </div>`;
  }

  /* ---------- views: practice ---------- */
  function viewPractice(key) {
    const s = SK[key] || SUBJ[0];
    const ids = practiceIds(s), st = stats(ids);
    const blocks = D.plan.flatMap(p => p.ranges.filter(([a]) => a[0] === s.code).map(([a, b]) => ({ day: p.day, a, b })));
    const topics = {};
    ids.forEach(id => { const t = Q[id].topic; (topics[t] = topics[t] || []).push(id); });
    const wrong = ids.filter(id => S.att[id] && !S.att[id].ok).length;
    const fresh = ids.filter(id => !S.att[id]).length;
    return `
    <div class="page-head"><span class="eyebrow">แบบฝึกแยกวิชา ${fmtN(PRACTICE_Q)} ข้อ</span><h1>ฝึกโจทย์</h1><p>ทำโดยไม่เปิดเฉลย ทำเครื่องหมายข้อที่เดาหรือลังเล แม้ตอบถูกก็ต้องทบทวน ข้อสอบจำลอง ${fmtN(MOCK_Q * MOCKS)} ข้อแยกไว้ในหน้าข้อสอบจำลอง</p></div>
    <div class="subj-tabs">${SUBJ.map(x => `<a class="chip subj s-${x.key} ${x === s ? "on" : ""}" href="#practice-${x.key}">${esc(x.short)} <span class="n num">${stats(practiceIds(x)).done}/${x.practice}</span></a>`).join("")}</div>
    <section class="card s-${s.key} stack">
      <div class="row" style="justify-content:space-between"><h2 style="font-size:22px">${esc(s.name)}</h2><span class="muted num">${st.done}/${st.total} ข้อ${st.acc !== null ? ` · ถูก ${st.acc}%` : ""}</span></div>
      ${bar2(st)}
      <div class="row">
        <button class="btn primary" data-act="quick" data-s="${s.key}" data-mode="fresh" ${fresh ? "" : "disabled"}>ข้อที่ยังไม่ทำ (${fresh})</button>
        <button class="btn" data-act="quick" data-s="${s.key}" data-mode="random">สุ่ม 20 ข้อ</button>
        <button class="btn" data-act="quick" data-s="${s.key}" data-mode="wrong" ${wrong ? "" : "disabled"}>ข้อที่ผิด (${wrong})</button>
      </div>
    </section>
    <section class="stack">
      <h2 style="font-size:20px">ตามแผนรายวัน</h2>
      <div class="grid g3">${blocks.map(bk => { const bs = stats(span(bk.a, bk.b)); return `<div class="card s-${s.key} stack" style="gap:8px;padding:14px 16px">
        <div class="row" style="justify-content:space-between"><a href="#day-${bk.day}" style="font-family:var(--f-display)">วันที่ ${bk.day}</a><span class="code">${bk.a}–${bk.b}</span></div>
        ${bar2(bs)}<div class="row" style="justify-content:space-between"><span class="muted small num">${bs.done}/${bs.total}${bs.acc !== null ? ` · ถูก ${bs.acc}%` : ""}</span><button class="btn sm" data-act="range" data-a="${bk.a}" data-b="${bk.b}" data-day="${bk.day}">ฝึก</button></div></div>`; }).join("")}</div>
    </section>
    <section class="stack">
      <h2 style="font-size:20px">ตามหัวข้อ</h2>
      <div class="row s-${s.key}" style="gap:8px">${Object.entries(topics).map(([t, l]) => { const ts = stats(l); return `<button class="chip subj" data-act="topic" data-s="${s.key}" data-topic="${esc(t)}">${esc(t)} <span class="n num">${ts.done}/${ts.total}${ts.acc !== null ? " · " + ts.acc + "%" : ""}</span></button>`; }).join("")}</div>
    </section>`;
  }

  /* ---------- quiz player ---------- */
  function startQuiz(list, title, back, nav = "practice") {
    if (!list.length) return;
    quiz = { ids: list, i: 0, title, back, nav, picked: {} };
    go("quiz");
  }
  function viewQuiz() {
    if (!quiz) { setTimeout(() => go("practice")); return ""; }
    const { ids, i, title, back, picked } = quiz;
    const total = ids.length;
    const right = Object.entries(picked).filter(([id, c]) => Q[id].ans === c).length;
    const head = `<div class="quiz-top"><a class="btn ghost sm" href="#${back}">← ออก</a><b style="font-family:var(--f-display)">${esc(title)}</b><span class="muted num small">ถูก ${right}/${Object.keys(picked).length}</span></div>${bar(Math.min(i, total) / total * 100)}`;
    if (i >= total) {
      const wrongIds = ids.filter(id => picked[id] !== undefined && picked[id] !== Q[id].ans);
      const by = {};
      ids.forEach(id => { const t = Q[id].topic; by[t] = by[t] || { ok: 0, done: 0, total: 0, s: Q[id].s }; by[t].total++; if (picked[id] === undefined) return; by[t].done++; if (picked[id] === Q[id].ans) by[t].ok++; });
      const n = Object.keys(picked).length;
      return `<div class="quiz">${head}
        <div class="card qcard taped" style="align-items:center;text-align:center">
          ${MASCOT ? `<img src="${MASCOT}" alt="" width="96" height="124">` : ""}
          <span class="eyebrow">จบชุดฝึก</span>
          <div class="score-big num">${right}<span class="muted" style="font-size:28px"> / ${n}</span></div>
          <p class="muted">${n ? (right / n >= .8 ? "แม่นแล้ว เว้นช่วงแล้วกลับมาทำข้อที่ลังเลอีกครั้ง" : "อ่านเฉลยแล้วเขียนเหตุผลสั้น ๆ ว่าทำไมคำตอบนั้นถูกและพลาดตรงไหน") : "ยังไม่ได้ตอบข้อใด"}</p>
        </div>
        <div class="row" style="justify-content:center">
          ${wrongIds.length ? `<button class="btn primary" data-act="redo-wrong">ทำข้อที่ผิดอีกครั้ง (${wrongIds.length})</button>` : ""}
          <a class="btn" href="#review">เปิดสมุดข้อผิด</a><a class="btn ghost" href="#${back}">กลับ</a>
        </div>
        <div class="card stack"><h2 style="font-size:18px">หัวข้อในชุดนี้</h2><ul class="plain weak">${Object.entries(by).map(([t, v]) => `<li class="s-${v.s.key}"><span>${esc(t)}</span><span class="num small">ถูก ${v.ok}/${v.total}${v.done < v.total ? ` · ไม่ได้ตอบ ${v.total - v.done}` : ""}</span>${bar2(v)}<span></span></li>`).join("")}</ul></div>
      </div>`;
    }
    const id = ids[i], q = Q[id], ch = picked[id], answered = ch !== undefined, a = S.att[id] || {};
    const chs = (q.s.topicMap[q.topic] || []);
    return `<div class="quiz s-${q.s.key}">${head}
      <div class="card qcard">
        <div class="qmeta">${subjChip(q.s)}<span class="code">${id}</span><span class="muted small">${esc(q.topic)}</span><span class="muted small num" style="margin-left:auto">ข้อ ${i + 1}/${total}</span></div>
        <div class="stem" id="q-stem">${esc(q.stem)}</div>
        <div class="opts" role="group" aria-labelledby="q-stem">${q.opts.map((o, k) => {
          const cls = answered ? (k === q.ans ? "right" : k === ch ? "wrong" : "") : "";
          return `<button class="opt ${cls}" data-act="pick" data-k="${k}" ${answered ? "disabled" : ""}><span class="k">${CIRC[k]}</span><span>${esc(o)}</span></button>`;
        }).join("")}</div>
        ${answered ? `<div class="feedback" aria-live="polite">
          <div class="verdict ${ch === q.ans ? "ok" : "no"}">${ch === q.ans ? "ถูกต้อง" : `ยังไม่ถูก คำตอบคือ ${CIRC[q.ans]}`}</div>
          <div>${esc(q.ex)}</div>
          ${q.src ? `<div class="muted small">แหล่งอ้างอิง [${esc(q.src)}] ดูได้ใน<a href="#guide">คู่มือ</a></div>` : ""}
          ${ch !== q.ans ? `<div class="why"><span class="muted">พลาดเพราะ</span>${REASONS.slice(0, 4).map(r => `<button class="chip ${a.why === r ? "on" : ""}" data-act="why" data-r="${r}">${r}</button>`).join("")}</div>` : ""}
          ${chs.length ? `<div class="small">อ่านทวน: ${chs.map(n => `<a href="#notes-${q.s.key}-${n}">บท ${n} ${esc(q.s.chapters.find(c => c.n === n).title.split(":")[0])}</a>`).join(" · ")}</div>` : ""}
        </div>` : ""}
      </div>
      <div class="quiz-foot">
        <button class="btn sm" data-act="prev" ${i === 0 ? "disabled" : ""}>← ก่อนหน้า</button>
        <button class="btn sm ${a.flag ? "flag-on" : ""}" data-act="flag" ${answered ? "" : "disabled"} aria-pressed="${!!a.flag}">${a.flag ? "★ ลังเล (จะทบทวน)" : "☆ ข้อนี้ลังเล"}</button>
        <button class="btn sm ${answered ? "primary" : ""}" data-act="next">${i === total - 1 ? "ดูสรุป" : answered ? "ข้อถัดไป →" : "ข้าม →"}</button>
      </div>
      <p class="kbd">แป้น 1-4 เลือกคำตอบ · Enter ข้อถัดไป · F ทำเครื่องหมายลังเล</p>
    </div>`;
  }

  /* ---------- mock exam ---------- */
  function viewMock(k, sub) {
    if (!(k >= 1 && k <= MOCKS)) return viewMockList();
    if (sub === "result") return viewMockResult(k);
    if (!S.run || S.run.set !== k) {
      const hist = S.mocks[k] || [];
      return `<div class="crumb"><a href="#mock">ข้อสอบจำลอง</a> / <span>ชุดที่ ${k}</span></div>
      <div class="card taped stack" style="max-width:720px;width:100%;margin:12px auto 0">
        ${MOCK_DAY[k] ? `<span class="eyebrow">ตามแผนวันที่ ${MOCK_DAY[k]}</span>` : ""}
        <h1 style="font-size:30px">ข้อสอบจำลอง ชุดที่ ${k}</h1>
        <p>${MOCK_Q} ข้อ · ${MOCK_Q} คะแนน · เวลา ${D.mock.minutes} นาที เลือกหนึ่งคำตอบต่อข้อ ไม่ใช้เครื่องคิดเลข จับเวลาและหยุดเมื่อครบเวลา</p>
        <div class="tbl"><table><thead><tr><th>วิชา</th><th class="r">ข้อ</th></tr></thead><tbody>${SUBJ.map((s, i) => { const st = SUBJ.slice(0, i).reduce((n, x) => n + x.perSet, 0); return `<tr><td>${esc(s.name)}</td><td class="r num">${st + 1}-${st + s.perSet}</td></tr>`; }).join("")}</tbody></table></div>
        ${PARTS.length ? `<p class="small">${PARTS.map(p => `${esc(p.name)} ${p.subjects.reduce((n, c) => n + SK[c].perSet, 0)} คะแนน ต้องได้อย่างน้อย ${Math.round(p.pass * 100)}%`).join(" · ")} ต้องผ่านทุกภาคแยกกัน</p>` : ""}
        <p class="muted small">ชุดนี้เป็นข้อสอบแต่งใหม่สำหรับฝึกตามสัดส่วนวิชา ไม่ใช่ข้อสอบจริง เวลาจะเดินต่อแม้ปิดหน้าเว็บ เตรียมพื้นที่และกระดาษทดก่อนเริ่ม</p>
        ${S.run ? `<p class="trap">กำลังทำชุดที่ ${S.run.set} ค้างอยู่ <a href="#mock-${S.run.set}">กลับไปทำต่อ</a> หรือเริ่มชุดนี้เพื่อยกเลิกชุดเดิม</p>` : ""}
        <div class="row"><button class="btn primary" data-act="mock-start" data-k="${k}">เริ่มจับเวลา ${D.mock.minutes} นาที</button>${hist.length ? `<a class="btn" href="#mock-${k}-result">ผลล่าสุด ${hist[hist.length - 1].score}/${MOCK_Q}</a>` : ""}</div>
      </div>`;
    }
    const run = S.run, ids = mockIds(k);
    const answered = Object.keys(run.ans).length;
    let num = 0;
    const parts = SUBJ.map(s => {
      const list = ids.filter(id => Q[id].s === s);
      const first = num + 1;
      const html = list.map(id => {
        num++;
        const q = Q[id], c = run.ans[id];
        return `<div class="card mock-q" id="mq-${num}">
          <div class="qmeta"><b class="num" style="font-family:var(--f-display)">${num}.</b><span class="code">${id}</span>
            <button class="btn sm ghost ${run.flag[id] ? "flag-on" : ""}" style="margin-left:auto" data-act="mflag" data-id="${id}" aria-pressed="${!!run.flag[id]}">${run.flag[id] ? "★ ค้างไว้" : "☆ ค้างไว้"}</button></div>
          <div class="stem">${esc(q.stem)}</div>
          <div class="opts">${q.opts.map((o, j) => `<button class="opt ${c === j ? "sel" : ""}" data-act="mpick" data-id="${id}" data-k="${j}" data-num="${num}"><span class="k">${CIRC[j]}</span><span>${esc(o)}</span></button>`).join("")}</div>
        </div>`;
      }).join("");
      return `<div class="part-head s-${s.key}" id="mp-${s.key}">${esc(s.name)} · ข้อ ${first}-${num}</div>${html}`;
    }).join("");
    return `<div class="crumb"><a href="#mock">ข้อสอบจำลอง</a> / <span>ชุดที่ ${k} กำลังทำ</span></div>
    <div class="mock-shell">
      <div class="stack">${parts}</div>
      <aside class="card sheet" aria-label="กระดาษคำตอบ">
        <div class="row" style="justify-content:space-between;align-items:flex-end"><div><span class="eyebrow">เวลาที่เหลือ</span><div class="timer" id="timer">${fmtClock(LIMIT - (Date.now() - run.start))}</div></div><span class="muted num small" id="answered">ตอบแล้ว ${answered}/${MOCK_Q}</span></div>
        <div class="bubbles" id="bubbles">${ids.map((id, j) => `<a href="#mock-${k}" data-act="jump" data-num="${j + 1}" class="${run.ans[id] !== undefined ? "done" : ""} ${run.flag[id] ? "fl" : ""}" aria-label="ข้อ ${j + 1}">${j + 1}</a>`).join("")}</div>
        <p class="muted small">ทึบ = ตอบแล้ว · ขอบเหลือง = ค้างไว้กลับมาดู</p>
        ${confirmOpen ? `<div class="confirm"><b>ส่งคำตอบตอนนี้?</b><span>ยังไม่ได้ตอบ ${MOCK_Q - answered} ข้อ ข้อที่ว่างนับเป็นผิด</span><div class="row"><button class="btn sm primary" data-act="mock-submit">ยืนยันส่ง</button><button class="btn sm" data-act="mock-cancel">ทำต่อ</button></div></div>`
          : `<button class="btn primary" data-act="mock-confirm">ส่งคำตอบและตรวจ</button>`}
        <button class="btn ghost sm" data-act="mock-abandon">ยกเลิกชุดนี้โดยไม่บันทึก</button>
      </aside>
    </div>`;
  }
  function startTimer() {
    const upd = () => {
      if (!S.run) return;
      const left = LIMIT - (Date.now() - S.run.start);
      if (left <= 0) { submitMock(); return; }
      const t = byId("timer"); if (t) { t.textContent = fmtClock(left); t.classList.toggle("low", left < 15 * 60 * 1000); }
    };
    upd(); tick = setInterval(upd, 1000);
  }
  function submitMock() {
    const run = S.run; if (!run) return;
    const k = run.set, ids = mockIds(k), by = {};
    let score = 0;
    ids.forEach(id => {
      const q = Q[id], c = run.ans[id], ok = c === q.ans;
      by[q.s.key] = by[q.s.key] || [0, 0]; by[q.s.key][1]++;
      if (ok) { score++; by[q.s.key][0]++; }
      if (c !== undefined) record(id, c);
      else { const a = S.att[id] || (S.att[id] = { n: 0, c: 0 }); a.n++; a.ok = false; a.ch = null; a.t = Date.now(); a.box = 1; a.due = dueIn(1); a.why = a.why || "รู้แต่เวลาไม่พอ"; }
      if (run.flag[id] && S.att[id]) { S.att[id].flag = 1; if (!S.att[id].box) { S.att[id].box = 1; S.att[id].due = dueIn(1); } }
    });
    (S.mocks[k] = S.mocks[k] || []).push({ at: Date.now(), dur: Math.min(LIMIT, Date.now() - run.start), ans: run.ans, flag: run.flag, score, by });
    S.run = null; confirmOpen = false; save();
    go(`mock-${k}-result`);
  }
  function mockBySubject(r) {
    return `<div class="stack" style="gap:8px">${SUBJ.map(s => { const [ok, n] = r.by[s.key] || [0, s.perSet]; return `<div class="s-${s.key}" style="display:grid;grid-template-columns:minmax(0,1fr) 2fr auto;gap:10px;align-items:center"><span class="small">${esc(s.short)}</span>${bar(ok / n * 100)}<span class="num small">${ok}/${n}</span></div>`; }).join("")}</div>`;
  }
  function viewMockResult(k) {
    const hist = S.mocks[k] || [], r = hist[hist.length - 1];
    if (!r) return `<div class="card empty"><p>ยังไม่มีผลชุดที่ ${k}</p><a class="btn" href="#mock-${k}">ไปทำชุด ${k}</a></div>`;
    const ids = mockIds(k);
    const wrong = ids.filter(id => r.ans[id] !== Q[id].ans);
    const guessed = ids.filter(id => r.flag && r.flag[id] && r.ans[id] === Q[id].ans);
    return `<div class="crumb"><a href="#mock">ข้อสอบจำลอง</a> / <span>ผลชุดที่ ${k}</span></div>
    <section class="grid g2">
      <div class="card taped stack">
        <span class="eyebrow">ข้อสอบจำลอง ชุดที่ ${k} · ${thDate(r.at, { day: "numeric", month: "long", year: "numeric" })}</span>
        <div class="score-big num">${r.score}<span class="muted" style="font-size:26px"> / ${MOCK_Q}</span></div>
        <p class="muted">ใช้เวลา ${fmtClock(r.dur)} · ผิดหรือเว้น ${wrong.length} ข้อ · เดาถูก ${guessed.length} ข้อ${hist.length > 1 ? ` · ครั้งก่อน ${hist[hist.length - 2].score}/${MOCK_Q}` : ""}</p>
        ${partsBlock(r)}
        <p class="small">${esc(M.mockResultNote)}</p>
        <div class="row">${wrong.length ? `<button class="btn primary" data-act="mock-wrong" data-k="${k}">ทำข้อผิดใหม่ (${wrong.length})</button>` : ""}<a class="btn" href="#mock-${k}">ทำชุดนี้อีกครั้ง</a></div>
      </div>
      <div class="card stack"><h2 style="font-size:18px">คะแนนแยกวิชา</h2>${mockBySubject(r)}
        <div class="bubbles" style="margin-top:6px">${ids.map((id, j) => `<a href="#mock-${k}-result" data-act="jump" data-num="${j + 1}" class="${r.ans[id] === Q[id].ans ? "ok" : "no"} ${r.flag && r.flag[id] ? "fl" : ""}" aria-label="ข้อ ${j + 1}">${j + 1}</a>`).join("")}</div>
      </div>
    </section>
    <section class="stack">
      <h2 style="font-size:20px">ข้อที่ผิดหรือเว้น พร้อมเฉลย</h2>
      ${wrong.map(id => { const q = Q[id], j = ids.indexOf(id) + 1, c = r.ans[id]; return `<div class="card mock-q s-${q.s.key}" id="mq-${j}">
        <div class="qmeta"><b class="num" style="font-family:var(--f-display)">${j}.</b>${subjChip(q.s)}<span class="code">${id}</span><span class="muted small">${esc(q.topic)}</span></div>
        <div class="stem">${esc(q.stem)}</div>
        <div class="opts">${q.opts.map((o, x) => `<div class="opt ${x === q.ans ? "right" : x === c ? "wrong" : ""}"><span class="k">${CIRC[x]}</span><span>${esc(o)}</span></div>`).join("")}</div>
        <div class="feedback"><div>${c === undefined || c === null ? "<b>เว้นไว้</b> · " : ""}${esc(q.ex)}</div></div>
      </div>`; }).join("") || `<div class="card empty"><p>ไม่มีข้อผิดในชุดนี้</p></div>`}
    </section>`;
  }
  function viewMockList() {
    const tip = M.mockGuide && D.guide.find(g => g.title.startsWith(M.mockGuide));
    return `<div class="page-head"><span class="eyebrow">ข้อสอบจำลอง ${MOCKS} ชุด รวม ${fmtN(MOCK_Q * MOCKS)} ข้อ</span><h1>ข้อสอบจำลอง</h1>
      <p>วันจำลองใช้เวลา ${D.mock.minutes} นาทีโดยไม่เปิดเฉลย ตรวจคะแนนแยกวิชาและบันทึกข้อที่เดาทันทีหลังจบ${ANALYZE_DAY[1] ? " ส่วนการวิเคราะห์เชิงลึกทำวันถัดไป" : ""}</p></div>
    ${S.run ? `<div class="card row" style="justify-content:space-between;background:var(--sun-soft);border-color:var(--sun)"><span>กำลังทำชุดที่ ${S.run.set} · ตอบแล้ว ${Object.keys(S.run.ans).length}/${MOCK_Q}</span><a class="btn primary" href="#mock-${S.run.set}">ทำต่อ</a></div>` : ""}
    <div class="grid g2">${MOCK_LIST.map(k => {
      const hist = S.mocks[k] || [], r = hist[hist.length - 1];
      const when = [MOCK_DAY[k] ? `แผนวันที่ ${MOCK_DAY[k]}` : "", ANALYZE_DAY[k] ? `วิเคราะห์วันที่ ${ANALYZE_DAY[k]}` : ""].filter(Boolean).join(" · ");
      return `<div class="card set-card ${k % 2 ? "taped" : ""}">
        <div class="row" style="justify-content:space-between"><h3>ชุดที่ ${k}</h3><span class="muted small">${when}</span></div>
        ${r ? `<div class="row" style="align-items:baseline"><span class="score-big num" style="font-size:40px">${r.score}</span><span class="muted">/ ${MOCK_Q} · ทำแล้ว ${hist.length} ครั้ง</span></div>${mockBySubject(r)}` : `<p class="muted">${MOCK_Q} ข้อ · ${D.mock.minutes} นาที · ${SUBJ.map(s => s.short + " " + s.perSet).join(" · ")}</p>`}
        <div class="row">${S.run && S.run.set === k ? `<a class="btn primary" href="#mock-${k}">ทำต่อ</a>` : `<a class="btn ${r ? "" : "primary"}" href="#mock-${k}">${r ? "ทำอีกครั้ง" : "เริ่มชุดนี้"}</a>`}${r ? `<a class="btn primary" href="#mock-${k}-result">ดูผลและเฉลย</a>` : ""}</div>
      </div>`;
    }).join("")}</div>
    <div class="card stack"><h2 style="font-size:18px">บริหารเวลา ${D.mock.minutes} นาที</h2><div class="prose">${tip ? md(tip.md) : `<p>${esc(M.mockTip)}</p>`}</div></div>`;
  }

  /* ---------- review notebook ---------- */
  function viewReview() {
    const due = dueList(), nb = notebook();
    const list = nb.filter(id => rvFilter === "all" || Q[id].s.key === rvFilter).sort((a, b) => S.att[a].due - S.att[b].due);
    const counts = {}; REASONS.forEach(r => counts[r] = 0);
    nb.forEach(id => { const w = S.att[id].why; if (w) counts[w]++; });
    const untagged = nb.filter(id => !S.att[id].why).length;
    return `<div class="page-head"><span class="eyebrow">สมุดข้อผิดพลาด</span><h1>สมุดข้อผิด</h1>
      <p>หนึ่งบรรทัดต่อข้อ: รหัสข้อ / หัวข้อ / เหตุที่พลาด / วันทำซ้ำ ระบบเว้นช่วงทบทวนเป็นวันถัดไป อีก 3 วัน และอีก 7 วัน ตอบถูกครบสามรอบจึงออกจากสมุด</p></div>
    <section class="card row taped" style="justify-content:space-between;background:var(--sun-soft);border-color:var(--sun)">
      <div><div style="font-family:var(--f-display);font-size:22px;font-weight:600" class="num">ครบรอบวันนี้ ${due.length} ข้อ</div><span class="muted small num">อยู่ในสมุดทั้งหมด ${nb.length} ข้อ</span></div>
      <button class="btn primary" data-act="review-due" ${due.length ? "" : "disabled"}>เริ่มทบทวน</button>
    </section>
    <section class="stack">
      <h2 style="font-size:20px">พลาดเพราะอะไร</h2>
      <div class="reason-grid">${REASONS.map(r => `<div class="card"><span class="small">${r}</span><b class="num">${counts[r]}</b><span class="muted small">${REASON_FIX[r]}</span></div>`).join("")}</div>
      ${untagged ? `<p class="muted small">ยังไม่ระบุสาเหตุ ${untagged} ข้อ เลือกสาเหตุในตารางด้านล่างเพื่อให้รู้ว่าต้องแก้แบบไหน</p>` : ""}
    </section>
    <section class="stack">
      <div class="sec-title"><h2>รายการในสมุด</h2>
        <div class="row" style="gap:6px"><button class="chip ${rvFilter === "all" ? "on" : ""}" data-act="rv-filter" data-s="all">ทั้งหมด</button>${SUBJ.map(s => `<button class="chip subj s-${s.key} ${rvFilter === s.key ? "on" : ""}" data-act="rv-filter" data-s="${s.key}">${esc(s.short)}</button>`).join("")}</div></div>
      ${list.length ? `<div class="tbl nb"><table><thead><tr><th>รหัสข้อ</th><th>หัวข้อ</th><th>สาเหตุที่พลาด</th><th class="r">รอบ</th><th>วันทวน</th><th></th></tr></thead><tbody>
        ${list.map(id => { const a = S.att[id], q = Q[id]; return `<tr><td><span class="code">${id}</span>${isMockId(id) ? ' <span class="muted small">จำลอง</span>' : ""}</td><td>${esc(q.topic)}</td>
          <td><label for="why-${id}" hidden>สาเหตุ ${id}</label><select id="why-${id}" data-act="why-sel" data-id="${id}"><option value="">— เลือก —</option>${REASONS.map(r => `<option ${a.why === r ? "selected" : ""}>${r}</option>`).join("")}</select></td>
          <td class="r num">${a.box}/3</td><td class="num ${a.due <= Date.now() ? "" : "muted"}" style="white-space:nowrap">${a.due <= Date.now() ? "<b>วันนี้</b>" : thDate(a.due)}</td>
          <td><button class="btn sm" data-act="one" data-id="${id}">ทำ</button></td></tr>`; }).join("")}
      </tbody></table></div>`
        : `<div class="card empty">${MASCOT ? `<img src="${MASCOT}" alt="">` : ""}<p>ยังไม่มีข้อในสมุด ข้อที่ตอบผิดหรือทำเครื่องหมายลังเลจะถูกบันทึกที่นี่อัตโนมัติ</p><a class="btn" href="#practice">ไปฝึกโจทย์</a></div>`}
    </section>`;
  }

  /* ---------- guide ---------- */
  function viewGuide() {
    return `<div class="page-head"><span class="eyebrow">ก่อนเริ่ม</span><h1>${esc(M.guideTitle)}</h1></div>
    ${D.guideIntro ? `<div class="card prose taped">${md(D.guideIntro)}</div>` : ""}
    ${D.guide.map(g => `<section class="card stack"><h2 style="font-size:21px">${esc(g.title)}</h2><div class="prose">${md(g.md)}</div></section>`).join("")}
    <section class="card stack" id="sources"><h2 style="font-size:21px">แหล่งอ้างอิงที่ใช้ตรวจเนื้อหา</h2>
      <ul class="plain stack" style="gap:6px">${D.sources.map(s => `<li class="small"><span class="code">[${esc(s.id)}]</span> ${/^https?:\/\//.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}${s.checked ? ` <span class="muted">· ตรวจ ${esc(s.checked)}</span>` : ""}</li>`).join("")}</ul>
    </section>`;
  }

  /* ---------- events ---------- */
  function quizPick(k) {
    if (!quiz || quiz.i >= quiz.ids.length) return;
    const id = quiz.ids[quiz.i];
    if (quiz.picked[id] !== undefined) return;
    quiz.picked[id] = k; record(id, k); save(); render();
  }
  function quizNext() { if (!quiz) return; quiz.i = Math.min(quiz.ids.length, quiz.i + 1); render(); }

  function onClick(e) {
    const t = e.target.closest("[data-act]"); if (!t || !root.contains(t)) return;
    const act = t.dataset.act, s = SK[t.dataset.s];
    const here = (location.hash || "#home").slice(1);
    switch (act) {
      case "pick": quizPick(+t.dataset.k); break;
      case "next": quizNext(); break;
      case "prev": if (quiz && quiz.i > 0) { quiz.i--; render(); } break;
      case "flag": { const id = quiz.ids[quiz.i]; setFlag(id, !(S.att[id] && S.att[id].flag)); render(); break; }
      case "why": { const id = quiz.ids[quiz.i]; S.att[id].why = t.dataset.r; save(); render(); break; }
      case "redo-wrong": { const w = quiz.ids.filter(id => quiz.picked[id] !== undefined && quiz.picked[id] !== Q[id].ans); startQuiz(w, quiz.title + " · ข้อที่ผิด", quiz.back, quiz.nav); break; }
      case "range": startQuiz(span(t.dataset.a, t.dataset.b), `วันที่ ${t.dataset.day} · ${t.dataset.a}–${t.dataset.b}`, here); break;
      case "chapter": { const n = +t.dataset.n; startQuiz(practiceIds(s).filter(id => (s.topicMap[Q[id].topic] || []).includes(n)), `${s.short} · บท ${n}`, here); break; }
      case "topic": startQuiz(practiceIds(s).filter(id => Q[id].topic === t.dataset.topic), `${s.short} · ${t.dataset.topic}`, here); break;
      case "topic-wrong": {
        const all = Object.keys(Q).filter(id => Q[id].s === s && Q[id].topic === t.dataset.topic);
        const w = all.filter(id => S.att[id] && (!S.att[id].ok || S.att[id].flag));
        startQuiz(w.length ? w : all.filter(id => !isMockId(id)), `ซ่อม · ${t.dataset.topic}`, here); break;
      }
      case "quick": {
        const ids = practiceIds(s), m = t.dataset.mode;
        const list = m === "fresh" ? ids.filter(id => !S.att[id]) : m === "wrong" ? ids.filter(id => S.att[id] && !S.att[id].ok) : shuffle(ids).slice(0, 20);
        startQuiz(m === "fresh" ? list.slice(0, 30) : list, `${s.short} · ${t.textContent.replace(/\s*\(\d+\)/, "")}`, here); break;
      }
      case "review-due": startQuiz(shuffle(dueList()), "ทบทวนข้อครบรอบ", "review", "review"); break;
      case "one": startQuiz([t.dataset.id], `ทำซ้ำ ${t.dataset.id}`, "review", "review"); break;
      case "read": {
        const k = t.dataset.k;
        if (S.read[k]) delete S.read[k]; else S.read[k] = 1;
        save();
        if (S.read[k] && t.dataset.next) go(t.dataset.next); else render(true);
        break;
      }
      case "rv-filter": rvFilter = t.dataset.s; render(); break;
      case "mock-wrong": { const k = +t.dataset.k, r = (S.mocks[k] || []).slice(-1)[0]; if (r) startQuiz(mockIds(k).filter(id => r.ans[id] !== Q[id].ans), `จำลองชุด ${k} · ข้อที่ผิด`, `mock-${k}-result`, "mock"); break; }
      case "mock-start": S.run = { set: +t.dataset.k, start: Date.now(), ans: {}, flag: {} }; confirmOpen = false; save(); render(); break;
      case "mpick": {
        e.preventDefault();
        const id = t.dataset.id, k = +t.dataset.k;
        S.run.ans[id] = k; save();
        t.parentElement.querySelectorAll(".opt").forEach((b, j) => b.classList.toggle("sel", j === k));
        const bub = root.querySelectorAll("#bubbles a")[+t.dataset.num - 1]; if (bub) bub.classList.add("done");
        const an = byId("answered"); if (an) an.textContent = `ตอบแล้ว ${Object.keys(S.run.ans).length}/${MOCK_Q}`;
        break;
      }
      case "mflag": { const id = t.dataset.id; if (S.run.flag[id]) delete S.run.flag[id]; else S.run.flag[id] = 1; save(); render(); break; }
      case "jump": { e.preventDefault(); const el = byId("mq-" + t.dataset.num); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); break; }
      case "mock-confirm": confirmOpen = true; render(); break;
      case "mock-cancel": confirmOpen = false; render(); break;
      case "mock-submit": submitMock(); break;
      case "mock-abandon": S.run = null; save(); go("mock"); break;
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === "start-date" && t.value) { S.start = t.value; save(); render(); }
    if (t.id === "day-done") { const n = +t.dataset.day; if (t.checked) S.days[n] = 1; else delete S.days[n]; save(); render(); }
    if (t.dataset.act === "why-sel") { const a = S.att[t.dataset.id]; if (t.value) a.why = t.value; else delete a.why; save(); render(); }
  }
  function onKey(e) {
    if (location.hash !== "#quiz" || !quiz || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (["1", "2", "3", "4"].includes(e.key)) { quizPick(+e.key - 1); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === "ArrowRight") { if (document.activeElement.tagName === "BUTTON" && e.key === "Enter") return; quizNext(); e.preventDefault(); }
    else if (e.key === "ArrowLeft" && quiz.i > 0) { quiz.i--; render(); }
    else if ((e.key === "f" || e.key === "F") && quiz.i < quiz.ids.length) { const id = quiz.ids[quiz.i]; if (quiz.picked[id] !== undefined) { setFlag(id, !(S.att[id] && S.att[id].flag)); render(); } }
  }
  function onHash() { confirmOpen = false; render(); }

  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", onHash);
  render();

  return {
    /* replace progress (e.g. a newer copy arrived from another device) and redraw */
    setState(next) { if (next && typeof next === "object" && !S.run) { S = Object.assign(blank(), next); render(true); } },
    getState() { return S; },
    destroy() {
      clearInterval(tick);
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
      root.innerHTML = "";
      root.classList.remove("exam-prep");
    },
  };
}

window.ExamPrep = { mount, localStore };
})();
