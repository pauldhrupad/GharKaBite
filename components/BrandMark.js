export default function BrandMark({ className = "", light = false }) {
  const house = light ? "#fffdf8" : "#27633d";
  const meal = light ? "#eda585" : "#c96743";

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.5 21.5 24 7l18.5 14.5" stroke={house} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 20.5v15m25-15v15" stroke={house} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M16 29h16c-.7 6.6-3.6 10-8 10s-7.3-3.4-8-10Z" fill={meal} />
      <path d="M15.5 29h17" stroke={meal} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 25c-2-2 .9-3.6 0-5.5" stroke={meal} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
