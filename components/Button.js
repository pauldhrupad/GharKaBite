import Link from "next/link";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-[0_10px_24px_rgba(39,99,61,0.18)]",
  secondary: "border border-border bg-surface text-text-primary hover:border-primary/40 hover:bg-surface-muted",
  light: "bg-white text-text-primary hover:bg-surface-muted",
  ghost: "text-primary hover:bg-primary/8",
};

export default function Button({ href, children, variant = "primary", className = "", ...props }) {
  const classes = `ui-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`;
  if (href) return <Link href={href} className={classes} {...props}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
