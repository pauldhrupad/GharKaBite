import localFont from "next/font/local";
import AppChrome from "@/components/AppChrome";
import Providers from "@/components/Providers";
import "./globals.css";

const manrope = localFont({
  src: "../public/fonts/manrope.woff2",
  variable: "--font-manrope",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: { default: "GharKaBite | Fresh Homemade Food Delivery", template: "%s | GharKaBite" },
  description: "Fresh homemade lunch and dinner delivered locally with flexible daily, weekly and monthly meal plans.",
  openGraph: { type: "website", siteName: "GharKaBite", title: "GharKaBite | Fresh Homemade Food Delivery", description: "Fresh homemade lunch and dinner delivered locally.", images: ["/images/kolkata-home-meal.png"] },
  twitter: { card: "summary_large_image", title: "GharKaBite", description: "Fresh homemade lunch and dinner delivered locally.", images: ["/images/kolkata-home-meal.png"] },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} antialiased`}>
      <body><Providers><AppChrome>{children}</AppChrome></Providers></body>
    </html>
  );
}
