import type { Metadata } from "next";
import localFont from 'next/font/local'
import "./globals.css";
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import AppToaster from '@/components/AppToaster'
import BackgroundImage from '@/components/BackgroundImage'

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.className} antialiased bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 min-h-screen`}>
        <BackgroundImage src="https://api.wenturc.com/" />
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
  <AppToaster />
      </body>
    </html>
  );
}
