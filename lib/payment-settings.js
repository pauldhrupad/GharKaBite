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
