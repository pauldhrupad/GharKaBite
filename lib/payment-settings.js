export function publicPaymentSettings(settings) {
  const upiDisplayName = settings?.upiDisplayName || "";
  const upiId = settings?.upiId || "";
  const upiPhoneNumber = settings?.upiPhoneNumber || "";
  const upiQrImage = settings?.upiQrImage || "";
  const businessWhatsApp = settings?.businessWhatsApp || "";
  const onlinePaymentEnabled = settings?.onlinePaymentEnabled === true && Boolean(upiQrImage || upiId || upiPhoneNumber);
  return { upiDisplayName, upiId, upiPhoneNumber, upiQrImage, businessWhatsApp, onlinePaymentEnabled, codEnabled: settings?.codEnabled !== false };
}

export function whatsappUrl(number, message) {
  const digits = String(number || "").replace(/\D/g, "");
  const international = digits.length === 10 ? `91${digits}` : digits;
  return international ? `https://wa.me/${international}?text=${encodeURIComponent(message)}` : "";
}

export const validUpiId = (id) => typeof id === "string" && /^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i.test(id);
export const validBusinessWhatsApp = (number) => typeof number === "string" && /^(?:91)?[6-9]\d{9}$/.test(number);
export const validProofRevision = (value) => value === null || (typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value));
export const canSubmitProof = (order) => order?.paymentMethod === "manual_online" && order.orderStatus === "payment_pending" && ["pending", "rejected"].includes(order.paymentStatus);

function validQr(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://res.cloudinary.com" && !url.username && !url.password && !url.search && !url.hash && /^\/[\w-]+\/image\/upload\/(?:v\d+\/)?gharkabite\/payment-qr\/[\w-]+\.(?:jpe?g|png|webp)$/i.test(url.pathname);
  } catch { return false; }
}

export function orderPaymentAvailability(order, settings, proofUploadAvailable) {
  const destinations = {};
  const businessWhatsApp = validBusinessWhatsApp(settings?.businessWhatsApp) ? settings.businessWhatsApp : "";
  const details = order.paymentDetails;
  const canPay = canSubmitProof(order) && order.total > 0;
  if (canPay && settings?.onlinePaymentEnabled === true && details) {
    if (validUpiId(details.upiId) && details.upiId === settings.upiId) destinations.upiId = details.upiId;
    if (/^[6-9]\d{9}$/.test(details.upiPhoneNumber || "") && details.upiPhoneNumber === settings.upiPhoneNumber) destinations.upiPhoneNumber = details.upiPhoneNumber;
    if (validQr(details.upiQrImage) && details.upiQrImage === settings.upiQrImage) destinations.upiQrImage = details.upiQrImage;
    if (Object.keys(destinations).length && settings.upiDisplayName) destinations.upiDisplayName = settings.upiDisplayName;
  }
  return {
    availability: !canPay ? "not_due" : !settings ? "unavailable" : Object.keys(destinations).length ? "available" : "paused",
    destinations, businessWhatsApp, proofUploadAvailable,
    channelsChanged: Boolean(canPay && details && ["upiId", "upiPhoneNumber", "upiQrImage"].some((field) => details[field] && !destinations[field])),
  };
}
