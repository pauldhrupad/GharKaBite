import { describe, expect, it } from "vitest";
import { authContinueHref, customerReturnTo } from "@/lib/auth-navigation";

describe("customer auth navigation", () => {
  it("keeps checkout and order destinations through either auth mode", () => {
    expect(authContinueHref("signin", "/checkout")).toBe("/login?callbackUrl=%2Fcheckout");
    expect(authContinueHref("signup", "/orders/GKB-123?view=payment#proof")).toBe("/register?callbackUrl=%2Forders%2FGKB-123%3Fview%3Dpayment%23proof");
    expect(authContinueHref("invalid", "/menu")).toBe("/login?callbackUrl=%2Fmenu");
  });
  it.each([undefined, ["/checkout"], "https://example.com", "//example.com", "/\\example.com", "/menu\n", "/welcome?mode=signup", "/login/", "/register", "/menu/../welcome", "/a/..//example.com", "/%2e//example.com", "/%2Fexample.com", "/%6cogin", "/owner/login"])("rejects unsafe destinations and auth loops: %s", (destination) => {
    expect(customerReturnTo(destination)).toBe("/profile");
  });
  it("allows same-origin Auth.js redirects without allowing an external normalized path", () => {
    const options = { origin: "https://gharkabite.example" };
    expect(customerReturnTo("https://gharkabite.example/checkout?mode=retry#confirm", options)).toBe("/checkout?mode=retry#confirm");
    expect(customerReturnTo("https://gharkabite.example/a/..//example.com", options)).toBe("/profile");
    expect(customerReturnTo("https://example.com/checkout", options)).toBe("/profile");
  });
});
