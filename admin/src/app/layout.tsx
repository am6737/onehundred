import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

// Runs in <head> before hydration/paint: applies the persisted theme
// (or the OS preference when none/"system") to avoid a light/dark flash.
// Default is LIGHT (matches Linear's product-app look). Only go dark when
// explicitly chosen, or when "system" is chosen and the OS prefers dark.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

// Inter is Linear's typeface. Wire it straight to --font-sans so the
// `font-sans` utility (mapped in globals.css @theme) resolves to it.
const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '一百见时 - 管理后台',
  description: '一百见时家庭成长记录管理后台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
