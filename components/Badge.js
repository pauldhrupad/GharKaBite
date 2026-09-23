const tones = {
  green: "bg-primary/10 text-primary",
  terracotta: "bg-accent/10 text-accent",
  muted: "bg-surface-muted text-text-secondary",
  warning: "bg-warning/10 text-warning",
};

const imageTones = {
  green: "bg-primary text-white",
  terracotta: "bg-[#8b3929] text-white",
  muted: "bg-[#24372b] text-white",
  warning: "bg-[#783b14] text-white",
};

export default function Badge({ children, tone = "green", onImage = false }) {
  return <span className={`inline-flex items-center rounded-full font-extrabold ${onImage ? `min-h-7 px-3 py-1 text-[13px] leading-4 shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/90 ${imageTones[tone]}` : `px-2.5 py-1 text-xs ${tones[tone]}`}`}>{children}</span>;
}
