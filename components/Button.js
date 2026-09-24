import Link from "next/link";

const variants = {
  primary: "border border-primary bg-primary text-white shadow-[0_6px_16px_rgba(35,77,60,0.16)] hover:border-primary-hover hover:bg-primary-hover",
  secondary: "border-[1.5px] border-primary bg-surface text-primary hover:bg-primary/5",
  light: "border border-surface bg-surface text-primary hover:bg-surface-alt",
  ghost: "text-primary hover:bg-primary/8",
};

export default function Button({ href, children, variant = "primary", className = "", ...props }) {
  const classes = `ui-action inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-disabled-bg disabled:bg-disabled-bg disabled:text-disabled-text disabled:shadow-none ${variants[variant]} ${className}`;
  if (href) return <Link href={href} className={classes} {...props}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
