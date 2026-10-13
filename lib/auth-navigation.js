export function customerReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/profile";
  const url = new URL(value, "https://gharkabite.invalid");
  if (["/welcome", "/login", "/register"].includes(url.pathname.replace(/\/$/, ""))) return "/profile";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function authContinueHref(mode, returnTo) {
  return `${mode === "signup" ? "/register" : "/login"}?callbackUrl=${encodeURIComponent(customerReturnTo(returnTo))}`;
}
