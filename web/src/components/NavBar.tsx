"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import ThemeToggle from "./ThemeToggle";
import LocaleToggle from "./LocaleToggle";

export default function NavBar() {
  const path = usePathname();
  const { t } = useT();
  const links = [
    { href: "/", label: t("nav.overview") },
    { href: "/groups", label: t("nav.groups") },
    { href: "/bracket", label: t("nav.bracket") },
    { href: "/versus", label: t("nav.versus") },
    { href: "/simulator", label: t("nav.simulator") },
    { href: "/methodology", label: t("nav.methodology") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 nav-bg backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Image
              src="/logo_wc.png"
              alt="World Cup 2026 Predictor"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
              priority
            />
            <span className="text-base">
              WC<span className="text-accent-green">26</span>
              <span className="ml-2 text-white/50 font-normal hidden sm:inline">{t("nav.tagline")}</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map((l) => {
              const active = l.href === "/" ? path === "/" : path?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
