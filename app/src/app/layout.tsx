import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getAtlasSummary } from "@/lib/atlas";

export const metadata: Metadata = {
  title: {
    default: "中国数据地图 | China Data Atlas — 中国官方统计数据研究平台",
    template: "%s | 中国数据地图 China Data Atlas",
  },
  description:
    "Make China's Data Accessible, Understandable, Traceable and Explorable. 汇聚国家统计局官方公开数据，覆盖中国大陆31省2000—2025年人口、经济、教育与医疗12大核心基准指标，支持历史趋势、省级排名、区域对比与CSV下载。",
  keywords: [
    "中国统计数据",
    "国家统计局",
    "分省数据",
    "中国人口",
    "中国GDP",
    "人均GDP",
    "人均可支配收入",
    "人口老龄化",
    "China Data Atlas",
  ],
  openGraph: {
    title: "中国数据地图 | China Data Atlas",
    description:
      "覆盖中国大陆31省2000—2025年官方统计数据，逐条可追溯、统计口径透明、零登录开放CSV下载。",
    type: "website",
    locale: "zh_CN",
    siteName: "中国数据地图 China Data Atlas",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const summary = getAtlasSummary();
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col bg-[#fafaf8] text-[#111827]">
        <LanguageProvider>
          <Navbar indicators={summary.indicators} regions={summary.regions} />
          <main className="flex-1">{children}</main>
          <Footer generatedAt={summary.generated_at} />
        </LanguageProvider>
      </body>
    </html>
  );
}
