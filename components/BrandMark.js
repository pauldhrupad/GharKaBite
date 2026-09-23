import Image from "next/image";

export default function BrandMark({ className = "", loading = "lazy" }) {
  return <Image src="/images/gharkabite-logo-v2.png" alt="GharKaBite logo" width={1254} height={1254} loading={loading} className={`object-contain ${className}`} />;
}
