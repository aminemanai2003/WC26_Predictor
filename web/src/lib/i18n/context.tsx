"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DICTS, type Dict, type Locale } from "./dicts";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
};

const LocaleCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "wc26-locale";

function getNested(obj: unknown, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem(STORAGE_KEY) as Locale | null)) || null;
    if (stored === "en" || stored === "fr") {
      setLocaleState(stored);
    } else if (typeof navigator !== "undefined" && navigator.language.startsWith("fr")) {
      setLocaleState("fr");
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const dict: Dict = DICTS[locale];
  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) =>
      interpolate(getNested(dict, path), vars),
    [dict]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useT() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error("useT must be used inside LocaleProvider");
  return ctx;
}
