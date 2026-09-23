export const defaultKitchenSettings = {
  dailyMaximum: 45,
  lunchMaximum: 25,
  dinnerMaximum: 20,
  lunchCutoff: "11:00",
  dinnerCutoff: "18:00",
  freeDeliveryThreshold: 399,
};

function getKolkataTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return { hour, minute };
}

export function isPastCutoff(period, settings = defaultKitchenSettings, date = new Date()) {
  const cutoff = period === "Lunch" ? settings.lunchCutoff : settings.dinnerCutoff;
  const [cutoffHour, cutoffMinute] = cutoff.split(":").map(Number);
  const { hour, minute } = getKolkataTimeParts(date);
  return (hour * 60) + minute >= (cutoffHour * 60) + cutoffMinute;
}

export function getPeriodAvailability(period, settings = defaultKitchenSettings, orders = [], date = new Date()) {
  const activeOrders = orders.filter((order) => order.orderStatus !== "cancelled");
  const dailyOrderCount = settings.currentCounts?.daily ?? activeOrders.length;
  const periodOrders = settings.currentCounts?.[period.toLowerCase()] ?? activeOrders.filter((order) => order.mealPeriod === period).length;
  const periodMaximum = period === "Lunch" ? Number(settings.lunchMaximum) : Number(settings.dinnerMaximum);

  if (dailyOrderCount >= Number(settings.dailyMaximum)) {
    return { available: false, reason: "Today’s order capacity is full. Please choose another available day." };
  }
  if (periodOrders >= periodMaximum) {
    return { available: false, reason: `Today’s ${period.toLowerCase()} orders are full. Please choose ${period === "Lunch" ? "dinner" : "another available day"}.` };
  }
  if (isPastCutoff(period, settings, date)) {
    return { available: false, reason: `${period} ordering has closed for today.` };
  }
  return { available: true, reason: "" };
}

export function formatCutoffTime(value) {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function getKolkataDayBounds(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
