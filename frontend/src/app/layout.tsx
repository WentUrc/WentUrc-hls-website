import type { Metadata } from "next";
import localFont from 'next/font/local'
import "./globals.css";
import NavBar from '@/components/NavBar'
import { Toaster } from 'sonner'

const inter = localFont({
  src: "../../public/font/InterVariable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WentUrc HLS 列表",
  description: "Manage uploads, generate HLS, and preview playlists",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: [
      "/logo.svg",
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
      <body className={`${inter.className} antialiased bg-white text-slate-900`}>
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
