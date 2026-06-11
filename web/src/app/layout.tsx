import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "WC 2026 — ML Predictions",
  description:
    "Machine-learning predictions and Monte Carlo simulation for the 2026 FIFA World Cup. Explore group odds, the bracket, and run your own what-if scenarios.",
  icons: {
    icon: "/logo_wc.png",
    shortcut: "/logo_wc.png",
    apple: "/logo_wc.png",
  },
  openGraph: {
    title: "WC 2026 — ML Predictions",
    description: "ML-powered predictions for the 2026 FIFA World Cup.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
