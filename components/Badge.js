const tones = {
  green: "bg-primary/10 text-primary",
  terracotta: "bg-accent/10 text-accent",
  muted: "bg-surface-muted text-text-secondary",
  warning: "bg-warning/10 text-warning",
};

export default function Badge({ children, tone = "green" }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${tones[tone]}`}>{children}</span>;
}
