const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

export function kolkataDate(offset = 0, now = new Date()) {
  const value = new Date(now.getTime() + offset * 86400000);
  const parts = formatter.formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function allowedOrderDate(date, now = new Date()) {
  return date === kolkataDate(0, now) || date === kolkataDate(1, now);
}

export function weekdayForDate(date) {
  return new Date(`${date}T12:00:00+05:30`).getUTCDay();
}

export function deliverySlotStart(date, period, slot) {
  const hour = Number(String(slot).match(/^\d+/)?.[0]);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return null;
  const twentyFourHour = period === "Lunch" ? (hour === 12 ? 12 : hour + 12) : hour + 12;
  return new Date(`${date}T${String(twentyFourHour).padStart(2, "0")}:00:00+05:30`);
}

export function periodCutoffPassed(date, period, settings, now = new Date()) {
  if (date !== kolkataDate(0, now)) return false;
  const cutoff = period === "Lunch" ? settings.lunchCutoff : settings.dinnerCutoff;
  const [hours, minutes] = cutoff.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const currentHour = Number(parts.find((item) => item.type === "hour")?.value || 0);
  const currentMinute = Number(parts.find((item) => item.type === "minute")?.value || 0);
  return currentHour * 60 + currentMinute >= hours * 60 + minutes;
}
