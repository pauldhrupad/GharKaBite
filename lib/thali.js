// Pure customization rules shared by the customer UI and server. The server always
// prices against the current database document, never the cart's displayed price.
const asArray = (value) => Array.isArray(value) ? value : [];
const money = (value) => Number.isInteger(Number(value)) ? Number(value) : NaN;
function preparation(entry, fallbackUnit = "portion") {
  const roti = /^rotis?$/i.test(entry.name || "");
  const countedRoti = String(entry.name || "").match(/^(\d+)\s+rotis?$/i);
  const legacyCount = countedRoti && (entry.preparationQuantity == null || Number(entry.preparationQuantity) === 1 && (!entry.preparationUnit || entry.preparationUnit === "portion"));
  return { preparationQuantity: legacyCount ? Number(countedRoti[1]) : entry.preparationQuantity ?? (roti ? 4 : 1), preparationUnit: legacyCount ? "pieces" : entry.preparationUnit || (roti || countedRoti ? "pieces" : fallbackUnit) };
}

export function missingChoiceMessage(group) {
  const options = asArray(group.options).filter((option) => option.active !== false);
  if (group.maxSelections === 1 && options.length === 2) return `Please choose ${options[0].name} or ${options[1].name}.`;
  return `Please choose an option for ${group.name}.`;
}

export function customizationSignature(choices = {}, addOns = {}) {
  const selectedChoices = Object.entries(choices).sort(([a], [b]) => a.localeCompare(b)).map(([id, values]) => [id, asArray(values).map(String).sort()]);
  const selectedAddOns = Object.entries(addOns).filter(([, quantity]) => Number(quantity) > 0).sort(([a], [b]) => a.localeCompare(b)).map(([id, quantity]) => [id, Number(quantity)]);
  return JSON.stringify([selectedChoices, selectedAddOns]);
}

export function calculateThaliPrice(thali, choices = {}, addOns = {}, quantity = 1) {
  if (!choices || typeof choices !== "object" || Array.isArray(choices) || !addOns || typeof addOns !== "object" || Array.isArray(addOns)) throw new Error("Invalid Thali customization.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("Choose 1 to 10 Thalis.");
  const groups = asArray(thali.choiceGroups);
  const addons = asArray(thali.addOns);
  const groupIds = new Set(groups.map((group) => group.id));
  const addonIds = new Set(addons.map((addon) => addon.id));
  if (Object.keys(choices).some((id) => !groupIds.has(id)) || Object.keys(addOns).some((id) => !addonIds.has(id))) throw new Error("A previous selection is no longer available. Please review your Thali.");
  const selectedChoices = [];
  let choiceAdjustments = 0;
  for (const group of groups) {
    const ids = choices[group.id] ?? [];
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new Error(`Review ${group.name}.`);
    const min = Number(group.minSelections ?? (group.required ? 1 : 0));
    const max = Number(group.maxSelections ?? 1);
    if (ids.length < min || ids.length > max) throw new Error(ids.length < min ? missingChoiceMessage(group) : `Choose no more than ${max} for ${group.name}.`);
    const options = ids.map((id) => {
      const option = asArray(group.options).find((entry) => entry.id === id);
      if (!option || option.active === false) throw new Error(`${group.name} has an unavailable selection. Please review your Thali.`);
      const priceAdjustment = money(option.priceAdjustment ?? 0);
      if (!Number.isFinite(priceAdjustment) || priceAdjustment < 0) throw new Error("Thali pricing is unavailable.");
      choiceAdjustments += priceAdjustment;
      return { id: option.id, name: option.name, priceAdjustment, ...preparation(option) };
    });
    selectedChoices.push({ groupId: group.id, groupName: group.name, options });
  }
  const selectedAddOns = [];
  let addOnTotal = 0;
  for (const [id, rawQuantity] of Object.entries(addOns)) {
    const count = Number(rawQuantity);
    if (!Number.isInteger(count) || count < 0) throw new Error("Choose a valid add-on quantity.");
    if (!count) continue;
    const addOn = addons.find((entry) => entry.id === id);
    if (!addOn || addOn.active === false || count > Number(addOn.maxQuantity ?? 1)) throw new Error(`${addOn?.name || "An add-on"} is unavailable in that quantity.`);
    const price = money(addOn.price);
    if (!Number.isFinite(price) || price < 0) throw new Error("Thali pricing is unavailable.");
    addOnTotal += price * count;
    selectedAddOns.push({ id, name: addOn.name, price, quantity: count, ...preparation(addOn, "piece") });
  }
  const basePrice = money(thali.price);
  if (!Number.isFinite(basePrice) || basePrice < 1) throw new Error("Thali pricing is unavailable.");
  const unitTotal = basePrice + choiceAdjustments + addOnTotal;
  return { basePrice, choiceAdjustments, addOnTotal, unitTotal, lineTotal: unitTotal * quantity,
    fixedItems: (asArray(thali.fixedItems).length ? thali.fixedItems : asArray(thali.contents).map((name) => ({ name }))).map((entry) => ({ name: entry.name, description: entry.description || "", ...preparation(entry) })),
    selectedChoices, selectedAddOns };
}

export function hasRequiredUnavailable(thali, quantity = 1) {
  return asArray(thali.choiceGroups).some((group) => Number(group.minSelections ?? (group.required ? 1 : 0)) > 0 && asArray(group.options).filter((option) => option.active !== false).length < Number(group.minSelections ?? 1));
}
