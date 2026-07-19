"use client";
import { meta } from "@/lib/data";
import { useT } from "@/lib/i18n/context";

export default function Footer() {
  const { t, locale } = useT();
  return (
    <footer className="mt-16 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/amine.jpg"
            alt="Amine Manai"
            className="h-14 w-14 rounded-full object-cover ring-2 ring-accent-green/40 shadow-glow"
          />
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40">{t("footer.builtBy")}</div>
            <div className="text-base font-semibold tracking-tight">Amine Manai</div>
            <div className="text-xs text-white/40 mt-0.5">{t("footer.tags")}</div>
          </div>
        </div>
        <div className="text-xs text-white/40 sm:text-right space-y-1">
          <div>
            {t("footer.modelLine", {
              version: meta.version,
              date: meta.trained_at?.slice(0, 10) ?? "",
              n: meta.n_matches_used?.toLocaleString(locale) ?? "",
            })}
          </div>
          <div>{t("footer.disclaimer")}</div>
        </div>
      </div>
    </footer>
  );
}
