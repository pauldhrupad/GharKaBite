import { kolkataDate } from "./dates";

export const defaultKitchenSettings = {
  acceptingOrders: true,
  lunchEnabled: true,
  dinnerEnabled: true,
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

export function getPeriodAvailability(period, settings = defaultKitchenSettings, _orders = [], date = new Date(), serviceDate = kolkataDate(0, date)) {
  if (settings.acceptingOrders === false) return { available: false, reason: "Ordering is temporarily paused by the kitchen." };
  if (period === "Lunch" && settings.lunchEnabled === false || period === "Dinner" && settings.dinnerEnabled === false) {
    return { available: false, reason: `${period} ordering is currently unavailable.` };
  }
  if (serviceDate === kolkataDate(0, date) && isPastCutoff(period, settings, date)) {
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
