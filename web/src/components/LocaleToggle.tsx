"use client";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export default function LocaleToggle() {
  const { locale, setLocale } = useT();
  return (
    <div className="inline-flex items-center rounded-md border border-white/10 overflow-hidden text-xs">
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={cn(
            "px-2 h-8 uppercase tracking-widest font-medium transition-colors",
            locale === l ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
          )}
          aria-pressed={locale === l}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
