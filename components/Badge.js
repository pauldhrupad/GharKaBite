const tones = {
  green: "border border-primary/25 bg-primary/10 text-primary",
  terracotta: "border border-accent/25 bg-accent/10 text-accent",
  muted: "border border-border bg-surface-alt text-text-secondary",
  warning: "border border-warning/25 bg-warning/10 text-warning",
  danger: "border border-danger/25 bg-danger/10 text-danger",
  neutral: "border border-border bg-disabled-bg text-text-primary",
};

const imageTones = {
  green: "bg-primary text-white",
  terracotta: "bg-accent text-white",
  muted: "bg-text-primary text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  neutral: "bg-text-secondary text-white",
};

export default function Badge({ children, tone = "green", onImage = false }) {
  return <span className={`inline-flex items-center rounded-full font-extrabold ${onImage ? `min-h-7 px-3 py-1 text-[13px] leading-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/90 ${imageTones[tone]}` : `px-2.5 py-1 text-xs ${tones[tone]}`}`}>{children}</span>;
}
