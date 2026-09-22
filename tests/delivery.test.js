import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDelivery, haversineKm } from "@/lib/delivery";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function configure() {
  vi.stubEnv("GEOAPIFY_API_KEY", "test-key");
  vi.stubEnv("KITCHEN_LATITUDE", "22.5000");
  vi.stubEnv("KITCHEN_LONGITUDE", "88.3000");
  vi.stubEnv("MAX_DELIVERY_RADIUS_KM", "5");
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
  it("checks the five kilometre straight-line radius", async () => {
    configure();
    mockGeoapify({ lat: 22.501, lon: 88.301, result_type: "street", rank: { confidence: 0.9 }, postcode: "700034" });
    expect((await checkDelivery(address)).serviceable).toBe(true);
    mockGeoapify({ lat: 22.6, lon: 88.4, result_type: "street", rank: { confidence: 0.9 }, postcode: "700034" });
    expect(await checkDelivery(address)).toMatchObject({ serviceable: false, reason: "Sorry, this address is currently outside our delivery area." });
    expect(haversineKm(22.5, 88.3, 22.6, 88.4)).toBeGreaterThan(5);
  });
});
