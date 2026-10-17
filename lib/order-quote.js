import crypto from "node:crypto";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function quoteInputHash(userId, payload, paymentMethod) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical({ userId: String(userId), payload, paymentMethod }))).digest("hex");
}

function signature(encoded) {
  if (!process.env.AUTH_SECRET) throw new Error("Checkout signing is unavailable.");
  return crypto.createHmac("sha256", process.env.AUTH_SECRET).update(`gharkabite-order-quote-v1:${encoded}`).digest("base64url");
}

export function signOrderQuote(inputHash, breakdown, requiresAcknowledgement = false) {
  const data = { inputHash, breakdown, requiresAcknowledgement, expiresAt: Date.now() + 10 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  return { ...breakdown, requiresAcknowledgement, expiresAt: data.expiresAt, pricingRevision: `${encoded}.${signature(encoded)}` };
}

export function readOrderQuote(token) {
  if (typeof token !== "string" || token.length > 40000) return null;
  const [encoded, signed, extra] = token.split(".");
  if (!encoded || !signed || extra) return null;
  const expected = signature(encoded);
  const actual = Buffer.from(signed);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString()); } catch { return null; }
}

export function sameQuotePrice(previous, current) {
  return JSON.stringify(previous) === JSON.stringify(current);
}
