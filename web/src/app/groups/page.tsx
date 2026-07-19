"use client";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Section } from "@/components/Section";
import TeamBadge from "@/components/TeamBadge";
import { teamByCode, teamsByGroup } from "@/lib/data";
import { useSimulation } from "@/lib/sim/useSimulation";
import { useT } from "@/lib/i18n/context";

export default function GroupsPage() {
  const { t, locale } = useT();
  const { result, run, status } = useSimulation();
  useEffect(() => { run({ iterations: 10000, seed: 11 }); }, [run]);

  const groups = useMemo(() => Object.keys(teamsByGroup).sort(), []);

  return (
    <>
      <Section title={t("groups.title")} description={t("groups.desc")}>
        {!result ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => (
              <div key={g} className="glass p-5 animate-pulse h-64" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g, gi) => {
              const teams = teamsByGroup[g];
              const rows = teams.map((t) => {
                const top1 = result.groupTop1[t.code] || 0;
                const top2 = result.groupTop2[t.code] || 0;
                const qual = result.qualifyR32[t.code] || 0;
                // qualify - top2 = third-and-advance share
                const top2Only = Math.max(0, top2 - top1);
                const thirdAdv = Math.max(0, qual - top2);
                const eliminated = Math.max(0, 1 - top1 - top2Only - thirdAdv);
                return { team: t, top1, top2Only, thirdAdv, eliminated, qual, xp: result.expectedPoints[t.code] || 0 };
              }).sort((a, b) => b.qual - a.qual);

              return (
                <motion.div
                  key={g}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05, duration: 0.4 }}
                  className="glass p-5"
                >
                  <div className="flex items-baseline justify-between mb-4">
                    <h3 className="text-lg font-semibold">{t("groups.group", { letter: g })}</h3>
                    <span className="text-xs text-white/40">{t("groups.pAdvance")}</span>
                  </div>
                  <div className="space-y-3">
                    {rows.map((r) => (
                      <div key={r.team.code} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3">
                        <TeamBadge team={r.team} size="sm" />
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
                          <div style={{ width: `${r.top1 * 100}%`, background: "#ffc857" }} title={`Win group: ${(r.top1 * 100).toFixed(1)}%`} />
                          <div style={{ width: `${r.top2Only * 100}%`, background: "#10e07d" }} title={`Runner-up: ${(r.top2Only * 100).toFixed(1)}%`} />
                          <div style={{ width: `${r.thirdAdv * 100}%`, background: "#4d8dff" }} title={`3rd & advance: ${(r.thirdAdv * 100).toFixed(1)}%`} />
                        </div>
                        <span className="text-right numeric text-sm font-medium">{(r.qual * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                    <span className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "#ffc857" }} />{t("groups.legend1st")}</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "#10e07d" }} />{t("groups.legend2nd")}</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "#4d8dff" }} />{t("groups.legend3rd")}</span>
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-xs text-white/40">
          {status === "running" || status === "loading"
            ? t("groups.runningSim")
            : t("groups.basedOn", { n: result?.iterations.toLocaleString(locale) || "" })}
        </p>
      </Section>
    </>
  );
}
