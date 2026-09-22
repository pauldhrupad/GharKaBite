import dbConnect from "./dbConnect";
import { meals as starterMeals } from "@/data/meals";
import Meal, { BADGES, CATEGORIES, MEAL_TYPES } from "@/models/Meal";
import DailyMenu from "@/models/DailyMenu";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import { kolkataDate, weekdayForDate } from "./dates";

const initialPlans = [
  { slug: "trial", name: "Trial Plan", description: "Try three fresh meals on your schedule.", mealCount: 3, price: 249, validityDays: 5 },
  { slug: "weekly", name: "Weekly Plan", description: "Seven flexible lunches or dinners.", mealCount: 7, price: 539, validityDays: 10 },
  { slug: "monthly", name: "Monthly Plan", description: "Twenty-six meals for your regular routine.", mealCount: 26, price: 1999, validityDays: 30 },
];

export async function seedCatalog() {
  await dbConnect();
  if (!await Meal.exists({})) {
    try {
      await Meal.insertMany(starterMeals.map((meal) => ({
        slug: meal.id, name: meal.name, shortDescription: meal.shortDescription,
        description: meal.description, price: meal.price, category: meal.category,
        mealType: meal.mealType, contents: meal.contents, slots: meal.slots,
        availableDays: [0, 1, 2, 3, 4, 5, 6], stockLimit: meal.stock,
        active: meal.available, featured: meal.featured,
        badges: meal.badges.filter((badge) => BADGES.includes(badge)), image: meal.image,
      })), { ordered: false });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
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
  const contents = Array.isArray(input.contents) ? input.contents.map((item) => plain(item, 100)) : [];
  const slots = Array.isArray(input.slots) ? [...new Set(input.slots)] : [];
  const days = Array.isArray(input.availableDays) ? [...new Set(input.availableDays.map(Number))] : [];
  const badges = Array.isArray(input.badges) ? [...new Set(input.badges)] : [];
  if (!CATEGORIES.includes(input.category) || !MEAL_TYPES.includes(input.mealType) || !Number.isInteger(price) || price < 1 || price > 10000 || !Number.isInteger(stockLimit) || stockLimit < 0 || stockLimit > 10000 || !contents.length || contents.length > 20 || !slots.length || slots.some((slot) => !["Lunch", "Dinner"].includes(slot)) || !days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || badges.some((badge) => !BADGES.includes(badge))) throw new Error("INVALID_MEAL");
  const image = String(input.image || "");
  const localImages = new Set(starterMeals.map((meal) => meal.image));
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudPrefix = cloud && `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/`;
  if (!localImages.has(image) && !(cloudPrefix && image.startsWith(cloudPrefix))) throw new Error("INVALID_MEAL");
  return { slug, name, shortDescription: plain(input.shortDescription, 180), description: plain(input.description, 1500), price, stockLimit, category: input.category, mealType: input.mealType, contents, slots, availableDays: days, badges, image, imagePublicId: String(input.imagePublicId || "").slice(0, 300), active: Boolean(input.active), featured: Boolean(input.featured) };
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
    return { id: meal.slug, name: meal.name, shortDescription: meal.shortDescription,
      description: meal.description, price: meal.price, category: meal.category,
      mealType: meal.mealType, contents: meal.contents, slots: meal.slots,
      image: meal.image, badges: meal.badges, featured: meal.featured,
      stock, available: Boolean(available && !daily?.soldOut && stock > 0) };
  });
}
