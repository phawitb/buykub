const BANGKOK_TIME_ZONE = "Asia/Bangkok";

function calendarParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

export function bangkokDateKey(date: Date) {
  const { year, month, day } = calendarParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function recentBangkokDays(count: number, now = new Date()) {
  const { year, month, day } = calendarParts(now);
  const today = new Date(Date.UTC(year, month - 1, day));

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (count - 1 - index));
    return {
      date,
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("th-TH", {
        weekday: "short",
        timeZone: "UTC",
      }),
    };
  });
}

export function startOfBangkokMonth(now = new Date()) {
  return `${bangkokDateKey(now).slice(0, 7)}-01T00:00:00+07:00`;
}

export function nextBangkokMonday(now = new Date()) {
  const today = recentBangkokDays(1, now)[0].date;
  const add = today.getUTCDay() === 1 ? 7 : ((8 - today.getUTCDay()) % 7 || 7);
  const next = new Date(today);
  next.setUTCDate(today.getUTCDate() + add);
  return next;
}
