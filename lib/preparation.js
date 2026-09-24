import dbConnect from "./dbConnect";
import Order from "@/models/Order";

const cookingStatuses = new Set(["confirmed", "cooking", "packed", "out_for_delivery", "delivered"]);

export function countsForPreparation(order) {
  if (!cookingStatuses.has(order.orderStatus)) return false;
  if (order.paymentMethod === "COD") return true;
  return order.paymentStatus === "paid";
}

function preparationDetails(item, fallbackUnit = "portion") {
  const roti = /^rotis?$/i.test(item.name || "");
  const countedRoti = String(item.name || "").match(/^(\d+)\s+rotis?$/i);
  const legacyCount = countedRoti && (item.preparationQuantity == null || Number(item.preparationQuantity) === 1 && (!item.preparationUnit || item.preparationUnit === "portion"));
  return {
    quantity: Number(legacyCount ? countedRoti[1] : item.preparationQuantity ?? (roti ? 4 : 1)),
    unit: legacyCount ? "pieces" : item.preparationUnit || (roti || countedRoti ? "pieces" : fallbackUnit),
  };
}

function add(map, entry, quantity, fallbackUnit) {
  if (!entry?.name || !quantity) return;
  const details = preparationDetails(entry, fallbackUnit);
  const name = /^(\d+)\s+rotis?$/i.test(entry.name) ? "Roti" : entry.name;
  const key = `${name.toLocaleLowerCase("en-IN")}::${details.unit.toLocaleLowerCase("en-IN")}`;
  const current = map.get(key) || { name, unit: details.unit, quantity: 0 };
  current.quantity += quantity * details.quantity;
  map.set(key, current);
}

function sorted(map) {
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function summarizePreparation(orders, { date, mealPeriod } = {}) {
  const selected = orders.filter((order) => (!date || order.serviceDate === date) && (!mealPeriod || order.mealPeriod === mealPeriod));
  const confirmed = selected.filter(countsForPreparation);
  const thalis = new Map();
  const menuItems = new Map();
  const selections = new Map();
  const addOns = new Map();
  const notes = [];
  let totalThalis = 0;
  for (const order of confirmed) {
    if (order.notes?.trim()) notes.push({ orderNumber: order.orderNumber, text: order.notes.trim() });
    for (const item of order.items || []) {
      const quantity = Number(item.quantity) || 0;
      if (item.kind === "dish") add(menuItems, { name: item.name, preparationQuantity: item.fixedItems?.[0]?.preparationQuantity ?? 1, preparationUnit: item.fixedItems?.[0]?.preparationUnit || "portion" }, quantity);
      else { add(thalis, { name: item.name, preparationQuantity: 1, preparationUnit: "Thali" }, quantity); totalThalis += quantity; }
      if (item.kind !== "dish") for (const fixed of item.fixedItems || []) add(selections, fixed, quantity, "portion");
      for (const group of item.selectedChoices || []) for (const option of group.options || []) add(selections, option, quantity, "portion");
      for (const extra of item.selectedAddOns || []) add(addOns, extra, quantity * (Number(extra.quantity) || 0), "piece");
    }
  }
  return {
    date, mealPeriod,
    confirmedOrders: confirmed.length,
    totalThalis,
    thalis: sorted(thalis), menuItems: sorted(menuItems), selections: sorted(selections), addOns: sorted(addOns), notes,
    awaitingPaymentVerification: selected.filter((order) => order.paymentMethod === "manual_online" && order.paymentStatus === "verification_pending" && order.orderStatus !== "cancelled").length,
    cancelled: selected.filter((order) => order.orderStatus === "cancelled").length,
  };
}

export async function generatePreparationSummary({ date, mealPeriod }) {
  await dbConnect();
  const orders = await Order.find({ serviceDate: date, mealPeriod }).lean();
  return summarizePreparation(orders, { date, mealPeriod });
}
