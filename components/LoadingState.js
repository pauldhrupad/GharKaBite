export function LoadingSpinner({ className = "" }) {
  return <span aria-hidden="true" className={`loading-spinner inline-block size-4 shrink-0 rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export default function LoadingState({ label = "Loading…", variant = "page", rows = 3, className = "" }) {
  return <div role="status" aria-label={label} className={`loading-state ${variant === "page" ? "container-shell py-8 md:py-12" : ""} ${className}`}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-4">
      <div className="loading-skeleton h-7 w-40 rounded-lg" />
      {Array.from({ length: rows }, (_, index) => <div key={index} className={`loading-skeleton rounded-2xl ${index === 0 ? "h-28" : "h-16"}`} />)}
    </div>
  </div>;
}
