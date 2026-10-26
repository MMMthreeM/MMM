import type { Metadata, Viewport } from "next";
import "./globals.css";
// 💡 改為引入我們剛建立的客戶端 Providers 包裝
import Providers from '@/components/Providers'; 
import ReportIssueButton from '@/components/ReportIssueButton';
import NoticeBanner from '@/components/NoticeBanner';

// 💡 伺服器端專屬的 PWA 資訊與手機主題顏色設定
export const metadata: Metadata = {
  title: "材料需求管理平台",
  description: "工班材料需求與審核平台",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "材料管理",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        {/* 💡 使用客戶端 Providers 包覆 */}
        <Providers>
          <NoticeBanner />
          {children}
        </Providers>
        <ReportIssueButton />
      </body>
    </html>
  );
}
