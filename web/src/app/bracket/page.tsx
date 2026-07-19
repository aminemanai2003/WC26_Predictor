"use client";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Section } from "@/components/Section";
import TeamBadge from "@/components/TeamBadge";
import { teams, teamByCode } from "@/lib/data";
import { useSimulation } from "@/lib/sim/useSimulation";
import { useT } from "@/lib/i18n/context";

const STAGE_KEYS = [
  { key: "qualifyR32", labelKey: "bracket.R32", short: "R32" },
  { key: "reachR16", labelKey: "bracket.R16", short: "R16" },
  { key: "reachQF", labelKey: "bracket.QF", short: "QF" },
  { key: "reachSF", labelKey: "bracket.SF", short: "SF" },
  { key: "reachFinal", labelKey: "bracket.F", short: "F" },
  { key: "champion", labelKey: "bracket.CH", short: "🏆" },
] as const;

export default function BracketPage() {
  const { t, locale } = useT();
  const { result, run } = useSimulation();
  useEffect(() => { run({ iterations: 10000, seed: 17 }); }, [run]);

  const stageRows = useMemo(() => {
    if (!result) return null;
    return STAGE_KEYS.map(({ key, labelKey, short }) => {
      const label = t(labelKey);
      const obj = result[key as keyof typeof result] as Record<string, number>;
      const ranked = Object.entries(obj)
        .map(([code, p]) => ({ team: teamByCode[code], p }))
        .filter((r) => r.team)
        .sort((a, b) => b.p - a.p);
      return { key, label, short, ranked };
    });
  }, [result, t]);

  return (
    <Section title={t("bracket.title")} description={t("bracket.desc")}>
      {!stageRows ? (
        <div className="glass p-6 h-96 animate-pulse" />
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[1080px] px-4 sm:px-0">
            <div className="grid grid-cols-6 gap-3">
              {stageRows.map(({ key, label, short, ranked }) => {
                const top = ranked.slice(0, 16);
                const max = top[0]?.p || 1;
                return (
                  <div key={key} className="glass p-3">
                    <div className="flex items-baseline justify-between mb-3">
                      <div className="text-sm font-semibold tracking-tight">{label}</div>
                      <div className="text-xs text-white/40">{short}</div>
                    </div>
                    <div className="space-y-1.5">
                      {top.map((row, i) => (
                        <motion.div
                          key={row.team.code}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.015 }}
                          className="relative rounded-md overflow-hidden"
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              width: `${(row.p / max) * 100}%`,
                              background:
                                key === "champion"
                                  ? "linear-gradient(90deg, rgba(255,200,87,0.35), rgba(255,200,87,0.10))"
                                  : "linear-gradient(90deg, rgba(16,224,125,0.22), rgba(16,224,125,0.04))",
                            }}
                          />
                          <div className="relative flex items-center justify-between px-2 py-1.5 text-xs">
                            <TeamBadge team={row.team} size="sm" />
                            <span className="numeric font-medium ml-2">
                              {(row.p * 100).toFixed(1)}%
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <p className="mt-6 text-xs text-white/40">
        {t("bracket.footer", { n: result?.iterations.toLocaleString(locale) || "" })}
      </p>
    </Section>
  );
}
