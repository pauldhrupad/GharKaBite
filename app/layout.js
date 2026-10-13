import localFont from "next/font/local";
import AppChrome from "@/components/AppChrome";
import Providers from "@/components/Providers";
import "./globals.css";

const manrope = localFont({
  src: "../public/fonts/manrope.woff2",
  variable: "--font-manrope",
  display: "swap",
});

const poppins = localFont({
  src: [
    { path: "../public/fonts/poppins-500.woff2", weight: "500" },
    { path: "../public/fonts/poppins-600.woff2", weight: "600" },
    { path: "../public/fonts/poppins-700.woff2", weight: "700" },
    { path: "../public/fonts/poppins-800.woff2", weight: "800" },
  ],
  variable: "--font-poppins",
  display: "swap",
  preload: false,
});

const nunito = localFont({
  src: "../public/fonts/nunito-sans-400-800.woff2",
  weight: "400 800",
  variable: "--font-nunito",
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
    <html lang="en" data-scroll-behavior="smooth" className={`${manrope.variable} ${poppins.variable} ${nunito.variable} antialiased`}>
      <body><Providers><AppChrome supportEmail={process.env.CONTACT_EMAIL || ""}>{children}</AppChrome></Providers></body>
    </html>
  );
}
