import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDelivery, checkLocation, haversineKm, validLocation } from "@/lib/delivery";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function configure() {
  vi.stubEnv("GEOAPIFY_API_KEY", "test-key");
  vi.stubEnv("KITCHEN_LATITUDE", "22.5000");
  vi.stubEnv("KITCHEN_LONGITUDE", "88.3000");
  vi.stubEnv("MAX_DELIVERY_RADIUS_KM", "3");
}

function mockGeoapify(properties) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ features: [{ properties }] }) })));
}

const address = { house: "12", street: "Test Road", area: "Behala", city: "Kolkata", pinCode: "700034" };

describe("delivery verification", () => {
  it("fails closed when the provider key is absent", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    expect(await checkDelivery(address)).toMatchObject({ serviceable: false, unavailable: true });
  });
  it("rejects ambiguous or mismatched addresses", async () => {
    configure();
    mockGeoapify({ lat: 22.501, lon: 88.301, result_type: "street", rank: { confidence: 0.5 }, postcode: "700034" });
    expect((await checkDelivery(address)).serviceable).toBe(false);
    mockGeoapify({ lat: 22.501, lon: 88.301, result_type: "street", rank: { confidence: 0.9 }, postcode: "700099" });
    expect((await checkDelivery(address)).serviceable).toBe(false);
  });
  it("checks the three kilometre straight-line radius", async () => {
    configure();
    mockGeoapify({ lat: 22.501, lon: 88.301, result_type: "street", rank: { confidence: 0.9 }, postcode: "700034" });
    expect((await checkDelivery(address)).serviceable).toBe(true);
    mockGeoapify({ lat: 22.6, lon: 88.4, result_type: "street", rank: { confidence: 0.9 }, postcode: "700034" });
    expect(await checkDelivery(address)).toMatchObject({ serviceable: false, reason: "Sorry, this address is currently outside our delivery area." });
    expect(haversineKm(22.5, 88.3, 22.6, 88.4)).toBeGreaterThan(3);
  });
  it.each([2.99, 3.01, 4])("checks a geocoded address %s km away", async (distance) => {
    configure();
    const lat = 22.5 + distance / 6371 * 180 / Math.PI;
    mockGeoapify({ lat, lon: 88.3, result_type: "street", rank: { confidence: 0.9 }, postcode: "700034" });
    expect((await checkDelivery(address)).serviceable).toBe(distance < 3);
  });
  it("defaults to three kilometres when no radius override is configured", async () => {
    configure();
    vi.stubEnv("MAX_DELIVERY_RADIUS_KM", "");
    mockGeoapify({ lat: 22.5 + 4 / 6371 * 180 / Math.PI, lon: 88.3, result_type: "street", rank: { confidence: 0.9 }, postcode: "700034" });
    expect((await checkDelivery(address)).serviceable).toBe(false);
  });
  it("includes the distance boundary for geocoded addresses and map pins", async () => {
    configure();
    const point = { lat: 22.5 + 3 / 6371 * 180 / Math.PI, lon: 88.3 };
    // Use the computed distance to avoid a floating-point rounding discrepancy at equality.
    const distance = haversineKm(22.5, 88.3, point.lat, point.lon);
    expect(distance).toBeCloseTo(3, 10);
    vi.stubEnv("MAX_DELIVERY_RADIUS_KM", String(distance));
    mockGeoapify({ ...point, result_type: "street", rank: { confidence: 0.9 }, postcode: "700034", country_code: "in", street: "Test Road", suburb: "Behala", city: "Kolkata" });
    expect((await checkDelivery(address)).serviceable).toBe(true);
    expect((await checkLocation(point, address)).serviceable).toBe(true);
  });
});

describe("map pin verification", () => {
  const near = { lat: 22.501, lon: 88.301 };
  const resolved = { country_code: "in", street: "Test Road", suburb: "Behala", city: "Kolkata", postcode: "700034", formatted: "Test Road, Behala" };

  it("validates coordinate types and ranges", () => {
    expect(validLocation(near)).toBe(true);
    expect(validLocation({ lat: "22.501", lon: 88.301 })).toBe(false);
    expect(validLocation({ lat: 91, lon: 88.301 })).toBe(false);
    expect(validLocation({ lat: NaN, lon: 88.301 })).toBe(false);
  });

  it("accepts an inside pin and rejects an outside pin or mismatched PIN", async () => {
    configure();
    mockGeoapify(resolved);
    expect(await checkLocation(near, address)).toMatchObject({ serviceable: true, address: { street: "Test Road", pinCode: "700034" } });
    expect((await checkDelivery({ ...address, location: near })).serviceable).toBe(true);
    expect((await checkLocation({ lat: 22.6, lon: 88.4 })).serviceable).toBe(false);
    expect((await checkLocation(near, { ...address, pinCode: "700001" })).serviceable).toBe(false);
  });

  it("checks points at the boundary and fails closed when reverse geocoding fails", async () => {
    configure();
    mockGeoapify(resolved);
    const justInside = { lat: 22.5 + 2.99 / 6371 * 180 / Math.PI, lon: 88.3 };
    const justOutside = { lat: 22.5 + 3.01 / 6371 * 180 / Math.PI, lon: 88.3 };
    expect((await checkLocation(justInside)).serviceable).toBe(true);
    expect((await checkLocation(justOutside)).serviceable).toBe(false);
    expect((await checkLocation({ lat: 22.5 + 4 / 6371 * 180 / Math.PI, lon: 88.3 })).serviceable).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await checkLocation(near)).toMatchObject({ serviceable: false, unavailable: true });
    mockGeoapify({ ...resolved, postcode: "" });
    expect((await checkLocation(near)).serviceable).toBe(false);
  });
});
