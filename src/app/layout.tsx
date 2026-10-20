import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getTheme } from "@/lib/i18n/server";

import "./globals.css";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Aldrich, Vietnamese build: page headings (--font-aldrich in globals.css) and the eyebrow label (components/ui/eyebrow.tsx). One weight only.
const fontAldrichVn = localFont({
  src: "../fonts/Aldrich-VN.ttf",
  variable: "--font-aldrich-vn",
  weight: "400",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "GIGABYTE Monitor Matrix", template: "%s · Monitor Matrix" },
  description: "Tra cứu thông số, so sánh đối thủ và theo dõi giá màn hình GIGABYTE tại đại lý Việt Nam",
  // Internal tool: keep it out of search engines
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#05070b", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Read on the server, so the page arrives in the right language and colours (no flash)
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html lang={locale} data-theme={theme} className={`${fontSans.variable} ${fontMono.variable} ${fontAldrichVn.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
