import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ValuationProvider } from "@/contexts/ValuationContext";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Equity Valuation Engine",
    template: "%s | Equity Valuation Engine",
  },
  description: "Automated DCF, Comparable Company Analysis, and Monte Carlo simulations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ValuationProvider>
          <div className="min-h-screen relative flex flex-col">
            <div className="fixed inset-0 pointer-events-none -z-10 bg-gradient-to-br from-black via-zinc-950 to-[#0A0A0A]"></div>

            <header className="w-full max-w-7xl mx-auto flex items-center justify-between px-8 pt-8 pb-4">
              <Link href="/" className="text-2xl font-semibold tracking-tighter text-white/90">
                Equity Valuation <span className="text-white/90">Lab</span>
              </Link>
              <nav className="flex items-center gap-3">
                <Link
                  href="/"
                  className="glass px-4 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  Home
                </Link>
                <Link
                  href="/history"
                  className="glass px-4 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  History
                </Link>
                <Link
                  href="/methodology"
                  className="glass px-4 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  Methodology
                </Link>
              </nav>
            </header>

            {children}
          </div>
        </ValuationProvider>
        <Analytics />
      </body>
    </html>
  );
}
