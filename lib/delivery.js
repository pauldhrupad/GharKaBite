const OUTSIDE = "Sorry, this address is currently outside our delivery area.";
const UNVERIFIED = "We couldn't verify this address. Please contact us for delivery confirmation.";

export function haversineKm(lat1, lon1, lat2, lon2) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function config() {
  const latitude = Number(process.env.KITCHEN_LATITUDE);
  const longitude = Number(process.env.KITCHEN_LONGITUDE);
  const radius = Number(process.env.MAX_DELIVERY_RADIUS_KM || 5);
  if (!process.env.GEOAPIFY_API_KEY || !process.env.KITCHEN_LATITUDE || !process.env.KITCHEN_LONGITUDE || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !Number.isFinite(radius) || radius <= 0) return null;
  return { latitude, longitude, radius, key: process.env.GEOAPIFY_API_KEY };
}

export function validLocation(location) {
  return location && typeof location === "object" && typeof location.lat === "number" && typeof location.lon === "number" && Number.isFinite(location.lat) && Number.isFinite(location.lon) && Math.abs(location.lat) <= 90 && Math.abs(location.lon) <= 180;
}

export async function searchMapAddresses(query) {
  const settings = config();
  if (!settings) return { status: "unavailable", suggestions: [] };
  if (typeof query !== "string" || query.trim().length < 3 || query.length > 150) return { status: "invalid", suggestions: [] };
  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", query.trim());
    url.searchParams.set("filter", "countrycode:in");
    url.searchParams.set("limit", "5");
    url.searchParams.set("apiKey", settings.key);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) return { status: "unavailable", suggestions: [] };
    const data = await response.json();
    return { status: "ok", suggestions: (data.features || []).filter((feature) => validLocation(feature.properties)).map((feature) => ({ label: feature.properties.formatted, location: { lat: feature.properties.lat, lon: feature.properties.lon } })).filter((item) => item.label).slice(0, 5) };
  } catch { return { status: "unavailable", suggestions: [] }; }
}

export async function checkLocation(location, address) {
  const settings = config();
  if (!settings) return { serviceable: false, reason: UNVERIFIED, unavailable: true };
  if (!validLocation(location)) return { serviceable: false, reason: "Choose a valid point on the map." };
  if (haversineKm(settings.latitude, settings.longitude, location.lat, location.lon) > settings.radius) return { serviceable: false, reason: OUTSIDE };
  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
    url.searchParams.set("lat", String(location.lat));
    url.searchParams.set("lon", String(location.lon));
    url.searchParams.set("format", "geojson");
    url.searchParams.set("apiKey", settings.key);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) return { serviceable: false, reason: UNVERIFIED, unavailable: true };
    const properties = (await response.json()).features?.[0]?.properties;
    const resolved = { street: properties?.street || "", area: properties?.suburb || properties?.district || properties?.city_district || "", city: properties?.city || properties?.town || "", pinCode: properties?.postcode || "" };
    if (properties?.country_code?.toLowerCase() !== "in" || !resolved.street || !resolved.area || !resolved.city || !/^\d{6}$/.test(resolved.pinCode)) return { serviceable: false, reason: "The pin needs a complete street address and PIN. Adjust it or enter the address manually." };
    const normal = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (address && (resolved.pinCode !== address.pinCode || ["street", "area", "city"].some((field) => normal(resolved[field]) !== normal(address[field])))) return { serviceable: false, reason: "The pin does not match the entered address. Choose the location again or enter the address manually." };
    return { serviceable: true, reason: "Delivery is available at this map pin.", address: resolved, label: properties.formatted || "" };
  } catch { return { serviceable: false, reason: UNVERIFIED, unavailable: true }; }
}

export async function suggestAddresses(query) {
  const settings = config();
  if (!settings) return { status: "unavailable", suggestions: [] };
  if (typeof query !== "string" || query.trim().length < 3 || query.length > 150) return { status: "invalid", suggestions: [] };
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", query.trim());
  url.searchParams.set("filter", "countrycode:in");
  url.searchParams.set("limit", "5");
  url.searchParams.set("apiKey", settings.key);
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!response.ok) return { status: "unavailable", suggestions: [] };
  const data = await response.json();
  return { status: "ok", suggestions: (data.features || []).map((feature) => feature.properties?.formatted).filter(Boolean).slice(0, 5) };
}

export async function checkDelivery(address) {
  if (address?.location) return checkLocation(address.location, address);
  const settings = config();
  if (!settings) return { serviceable: false, reason: UNVERIFIED, unavailable: true };
  const text = typeof address === "string" ? address.trim() : [address?.house, address?.street, address?.area, address?.city, address?.pinCode].filter(Boolean).join(", ");
  if (text.length < 10 || text.length > 300) return { serviceable: false, reason: UNVERIFIED };
  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", text);
    url.searchParams.set("filter", "countrycode:in");
    url.searchParams.set("limit", "1");
    url.searchParams.set("apiKey", settings.key);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) return { serviceable: false, reason: UNVERIFIED };
    const result = (await response.json()).features?.[0]?.properties;
    if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lon) || (result.rank?.confidence ?? 0) < 0.7 || ["country", "state", "city", "postcode", "suburb", "district"].includes(result.result_type) || (typeof address === "object" && address.pinCode && result.postcode !== address.pinCode)) return { serviceable: false, reason: UNVERIFIED };
    const distance = haversineKm(settings.latitude, settings.longitude, result.lat, result.lon);
    return distance <= settings.radius ? { serviceable: true, reason: "Delivery is available for this address." } : { serviceable: false, reason: OUTSIDE };
  } catch {
    return { serviceable: false, reason: UNVERIFIED };
  }
}
