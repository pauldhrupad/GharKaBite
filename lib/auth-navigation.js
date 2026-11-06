export function customerReturnTo(value, { origin, fallback = "/profile" } = {}) {
  if (typeof value !== "string" || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value) || (!origin && !value.startsWith("/"))) return fallback;
  const base = origin || "https://gharkabite.invalid";
  try {
    const url = new URL(value, base);
    const pathname = decodeURIComponent(url.pathname);
    if (url.origin !== base || url.username || url.password || url.pathname.startsWith("//") || pathname.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(pathname)) return fallback;
    if (["/welcome", "/login", "/register", "/owner/login"].includes(pathname.replace(/\/+$/, ""))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function authContinueHref(mode, returnTo) {
  return `${mode === "signup" ? "/register" : "/login"}?callbackUrl=${encodeURIComponent(customerReturnTo(returnTo))}`;
}
