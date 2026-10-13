import Image from "next/image";

export default function BrandMark({ className = "", loading = "lazy", variant }) {
  const wordmark = variant === "wordmark";
  const src = wordmark ? "/images/gharkabite-wordmark.png" : variant === "app" ? "/images/gharkabite-app-mark.png" : "/images/gharkabite-logo-v2.png";
  return <Image src={src} alt="GharKaBite logo" width={wordmark ? 2172 : 1254} height={wordmark ? 724 : 1254} sizes={wordmark ? "176px" : variant === "app" ? "40px" : undefined} loading={loading} className={`object-contain ${className}`} />;
}
