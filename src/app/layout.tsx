import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";

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

export const metadata: Metadata = {
  title: { default: "GIGABYTE Monitor Matrix", template: "%s · Monitor Matrix" },
  description: "Tra cứu thông số, so sánh đối thủ và theo dõi giá màn hình GIGABYTE tại đại lý Việt Nam",
  // Internal tool: keep it out of search engines
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#05070b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
