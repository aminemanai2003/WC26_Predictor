"use client";
import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/lib/i18n/context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <LocaleProvider>{children}</LocaleProvider>
    </ThemeProvider>
  );
}
