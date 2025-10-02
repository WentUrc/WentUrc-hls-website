import type { Metadata } from "next";
import localFont from 'next/font/local'
import "./globals.css";
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { Toaster } from 'sonner'

const inter = localFont({
  src: "../../public/font/InterVariable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WentUrc HLS 列表",
  description: "不要过来",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 移动端适配 */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.className} antialiased bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 min-h-screen`}>
        {/* 全局背景：随机图像（不挡交互、低透明、覆盖视口） */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 opacity-10 bg-no-repeat bg-center bg-cover"
          style={{ backgroundImage: "url('https://api.wenturc.com/')" }}
        />
        {/* 遮罩：顶部完全遮挡（白色 / 深色下为黑色），向下渐隐，保证上不可见、下可见 */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-white via-white/40 to-white/0 dark:from-black dark:via-black/40 dark:to-black/0"
        />
        <div className="relative z-10 min-h-screen flex flex-col">
          <NavBar />
          <main className="mx-auto max-w-6xl px-3 sm:px-4 py-6 flex-1 w-full">
            {children}
          </main>
          <Footer />
        </div>
        <Toaster richColors position="top-right" theme="system" />
      </body>
    </html>
  );
}
