import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Victor_Mono } from "next/font/google";
import "./globals.css";
import { BackgroundCanvas } from "@/components/BackgroundCanvas";
import { Footer } from "@/components/Footer";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const victorMono = Victor_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-victor",
  display: "swap",
});

const siteOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "MidPoint — Blind AI Deal Mediator for Freelance Developers",
  description:
    "Developer and Client submit project budget, scope hours, deposit, payment terms, and revisions blindly. MidPoint computes the fair middle ground and writes your SOW draft.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${victorMono.variable}`}
    >
      <body className="relative min-h-screen flex flex-col bg-[#07090D] text-[#F1F1F1] selection:bg-[#5661FF]/35 selection:text-white">
        <BackgroundCanvas />
        <div className="relative z-10 flex-1 flex flex-col">{children}</div>
        <div className="relative z-10">
          <Footer />
        </div>
      </body>
    </html>
  );
}
