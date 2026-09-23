import dbConnect from "./dbConnect";
import { meals as starterMeals } from "@/data/meals";
import Meal, { BADGES, CATEGORIES, MEAL_TYPES } from "@/models/Meal";
import DailyMenu from "@/models/DailyMenu";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import { kolkataDate, weekdayForDate } from "./dates";
import { initialThaliConfiguration, initialThaliSlugs, legacyMealSlugs } from "./thali-defaults";
import { hasRequiredUnavailable } from "./thali";

const initialPlans = [
  { slug: "trial", name: "Trial Plan", description: "Try three fresh meals on your schedule.", mealCount: 3, price: 249, validityDays: 5 },
  { slug: "weekly", name: "Weekly Plan", description: "Seven flexible lunches or dinners.", mealCount: 7, price: 539, validityDays: 10 },
  { slug: "monthly", name: "Monthly Plan", description: "Twenty-six meals for your regular routine.", mealCount: 26, price: 1999, validityDays: 30 },
];

export async function seedCatalog() {
  await dbConnect();
  if (await Meal.countDocuments({ slug: { $in: initialThaliSlugs } }) < initialThaliSlugs.length) await Promise.all(initialThaliSlugs.map(async (slug) => {
    const meal = starterMeals.find((entry) => entry.id === slug);
    try {
      await Meal.updateOne({ slug }, { $setOnInsert: {
        slug, price: meal.price, category: meal.category, mealType: meal.mealType,
        contents: initialThaliConfiguration[slug].fixedItems.map((item) => item.name), slots: meal.slots,
        availableDays: [0, 1, 2, 3, 4, 5, 6], stockLimit: meal.stock,
        active: meal.available, featured: meal.featured,
        badges: meal.badges.filter((badge) => BADGES.includes(badge)), image: meal.image,
        ...initialThaliConfiguration[slug], customizationVersion: 1,
      } }, { upsert: true });
    } catch (error) { if (error.code !== 11000) throw error; }
  }));
  // One-time, non-destructive migration of the four existing catalogue records.
  // Slugs and old order snapshots stay valid; admin edits are never overwritten.
  if (await Meal.exists({ slug: { $in: [...initialThaliSlugs, ...legacyMealSlugs] }, customizationVersion: { $ne: 1 } })) {
    await Promise.all(initialThaliSlugs.map((slug) => Meal.updateOne(
      { slug, customizationVersion: { $ne: 1 } },
      { $set: { ...initialThaliConfiguration[slug], contents: initialThaliConfiguration[slug].fixedItems.map((item) => item.name), customizationVersion: 1 } },
    )));
    await Meal.updateMany({ slug: { $in: legacyMealSlugs }, customizationVersion: { $ne: 1 } }, { $set: { active: false, customizationVersion: 1 } });
  }
  if (!await SubscriptionPlan.exists({})) {
    try {
      await SubscriptionPlan.insertMany(initialPlans.map((plan) => ({
        ...plan, allowedMealTypes: MEAL_TYPES, lunchAllowed: true,
        dinnerAllowed: true, mixedAllowed: true, active: true,
      })), { ordered: false });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}

export function normalizeMeal(input) {
  const plain = (value, max) => {
    const text = String(value || "").trim();
    if (!text || text.length > max || /<[^>]*>/.test(text)) throw new Error("INVALID_MEAL");
    return text;
  };
  const name = plain(input.name, 90);
  const slug = String(input.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("INVALID_MEAL");
  const price = Number(input.price);
  const stockLimit = Number(input.stockLimit);
  const id = (value) => { const text = String(value || ""); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text) || text.length > 60) throw new Error("INVALID_MEAL"); return text; };
  const priceValue = (value, max = 10000) => { const number = Number(value); if (!Number.isInteger(number) || number < 0 || number > max) throw new Error("INVALID_MEAL"); return number; };
  const stockValue = (value) => value === null || value === "" || value === undefined ? null : priceValue(value, 100000);
  const fixedItems = Array.isArray(input.fixedItems) ? input.fixedItems.map((item) => ({ name: plain(item.name, 100), description: String(item.description || "").trim().slice(0, 180) })) : (Array.isArray(input.contents) ? input.contents.map((name) => ({ name: plain(name, 100), description: "" })) : []);
  if (!fixedItems.length || fixedItems.length > 20) throw new Error("INVALID_MEAL");
  const contents = fixedItems.map((item) => item.name);
  const choiceGroups = Array.isArray(input.choiceGroups) ? input.choiceGroups.map((group) => {
    const options = Array.isArray(group.options) ? group.options.map((option) => ({ id: id(option.id), name: plain(option.name, 100), description: String(option.description || "").trim().slice(0, 180), priceAdjustment: priceValue(option.priceAdjustment ?? 0), active: option.active !== false, stock: stockValue(option.stock) })) : [];
    const minSelections = priceValue(group.minSelections ?? (group.required ? 1 : 0), 20);
    const maxSelections = priceValue(group.maxSelections ?? 1, 20);
    if (!options.length || options.length > 20 || minSelections > maxSelections || maxSelections < 1 || maxSelections > options.length || new Set(options.map((option) => option.id)).size !== options.length) throw new Error("INVALID_MEAL");
    return { id: id(group.id), name: plain(group.name, 100), description: String(group.description || "").trim().slice(0, 180), required: minSelections > 0, minSelections, maxSelections, displayType: maxSelections === 1 ? "single_choice" : "multiple_choice", options };
  }) : [];
  if (choiceGroups.length > 10 || new Set(choiceGroups.map((group) => group.id)).size !== choiceGroups.length) throw new Error("INVALID_MEAL");
  const addOns = Array.isArray(input.addOns) ? input.addOns.map((item) => ({ id: id(item.id), name: plain(item.name, 100), description: String(item.description || "").trim().slice(0, 180), price: priceValue(item.price), active: item.active !== false, maxQuantity: priceValue(item.maxQuantity ?? 1, 20), stock: stockValue(item.stock) })) : [];
  if (addOns.length > 30 || addOns.some((item) => item.maxQuantity < 1) || new Set(addOns.map((item) => item.id)).size !== addOns.length) throw new Error("INVALID_MEAL");
  const slots = Array.isArray(input.slots) ? [...new Set(input.slots)] : [];
  const days = Array.isArray(input.availableDays) ? [...new Set(input.availableDays.map(Number))] : [];
  const badges = Array.isArray(input.badges) ? [...new Set(input.badges)] : [];
  if (!CATEGORIES.includes(input.category) || !MEAL_TYPES.includes(input.mealType) || !Number.isInteger(price) || price < 1 || price > 10000 || !Number.isInteger(stockLimit) || stockLimit < 0 || stockLimit > 10000 || !slots.length || slots.some((slot) => !["Lunch", "Dinner"].includes(slot)) || !days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || badges.some((badge) => !BADGES.includes(badge))) throw new Error("INVALID_MEAL");
  const image = String(input.image || "");
  const localImages = new Set([...starterMeals.map((meal) => meal.image), "/images/kolkata-home-meal.png"]);
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudPrefix = cloud && `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/`;
  if (!localImages.has(image) && !(cloudPrefix && image.startsWith(cloudPrefix))) throw new Error("INVALID_MEAL");
  return { slug, name, shortDescription: plain(input.shortDescription, 180), description: plain(input.description, 1500), price, stockLimit, category: input.category, mealType: input.mealType, contents, fixedItems, choiceGroups, addOns, customizationVersion: 1, slots, availableDays: days, badges, image, imagePublicId: String(input.imagePublicId || "").slice(0, 300), active: Boolean(input.active), featured: Boolean(input.featured) };
}

export async function getMenu(date = kolkataDate()) {
  await seedCatalog();
  const meals = await Meal.find({ archivedAt: null, active: true }).sort({ featured: -1, name: 1 }).lean();
  const overrides = await DailyMenu.find({ date, meal: { $in: meals.map((meal) => meal._id) } }).lean();
  const byId = new Map(overrides.map((entry) => [String(entry.meal), entry]));
  const weekday = weekdayForDate(date);
  return meals.map((meal) => {
    const daily = byId.get(String(meal._id));
    const scheduled = meal.availableDays.includes(weekday);
    const available = daily?.availableOverride ?? scheduled;
    const stock = daily?.remaining ?? meal.stockLimit;
    const choiceUnavailable = hasRequiredUnavailable(meal);
    return { id: meal.slug, name: meal.name, shortDescription: meal.shortDescription,
      description: meal.description, price: meal.price, category: meal.category,
      mealType: meal.mealType, contents: meal.contents, fixedItems: meal.fixedItems?.length ? meal.fixedItems : meal.contents.map((name) => ({ name })), choiceGroups: meal.choiceGroups || [], addOns: meal.addOns || [], slots: meal.slots,
      image: meal.image, badges: meal.badges, featured: meal.featured,
      stock, choiceUnavailable, available: Boolean(available && !daily?.soldOut && stock > 0 && !choiceUnavailable) };
  });
}
