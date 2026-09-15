import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme";

export const metadata: Metadata = {
  title: {
    default: "币策 - 专业加密货币跟单交易平台",
    template: "%s | 币策",
  },
  description:
    "一键跟随顶级交易员，秒级同步到你的账户。支持 Binance、OKX、Bybit、Bitget、Gate 等 8 大主流交易所，零分润、不设跟单名额上限。",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
