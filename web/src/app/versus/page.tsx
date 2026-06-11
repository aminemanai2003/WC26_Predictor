"use client";
import { useEffect, useMemo, useState } from "react";
import { Section } from "@/components/Section";
import TeamBadge from "@/components/TeamBadge";
import ScorelineHeatmap from "@/components/ScorelineHeatmap";
import PredictedScoreboard from "@/components/PredictedScoreboard";
import { teams, teamByCode, getPairwise, meta } from "@/lib/data";
import type { Pairwise } from "@/lib/types";
import { motion } from "framer-motion";
import { useT } from "@/lib/i18n/context";

export default function VersusPage() {
  const { t } = useT();
  const [pairwise, setPairwise] = useState<Pairwise | null>(null);
  const [home, setHome] = useState("ARG");
  const [away, setAway] = useState("FRA");

  useEffect(() => { getPairwise().then(setPairwise); }, []);

  const pair = useMemo(() => pairwise ? pairwise[`${home}-${away}`] : null, [pairwise, home, away]);
  const ht = teamByCode[home], at = teamByCode[away];

  const orderedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), []);

  return (
    <Section title={t("versus.title")} description={t("versus.desc")}>
      <div className="glass p-5 sm:p-7">
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <SidePicker label={t("versus.home")} value={home} onChange={setHome} teams={orderedTeams} />
          <SidePicker label={t("versus.away")} value={away} onChange={setAway} teams={orderedTeams.filter((t) => t.code !== home)} />
        </div>

        {!pair || !ht || !at ? (
          <div className="h-72 animate-pulse rounded-md bg-white/5" />
        ) : (
          <div className="space-y-6">
            {/* Top: Predicted scoreboard */}
            <PredictedScoreboard pair={pair} rho={meta.dixon_coles_rho} home={ht} away={at} />

            {/* Below: heatmap + analytics */}
            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="flex items-center gap-2"><TeamBadge team={ht} size="md" /></span>
                  <span className="text-white/40 text-xs uppercase tracking-widest">{t("versus.scoreline")}</span>
                  <span className="flex items-center gap-2"><TeamBadge team={at} size="md" /></span>
                </div>
                <ScorelineHeatmap
                  pair={pair}
                  rho={meta.dixon_coles_rho}
                  homeName={ht.name}
                  awayName={at.name}
                />
              </motion.div>

              <div className="space-y-4">
                <WdlPanel pair={pair} ht={ht} at={at} />
                <ComparePanel ht={ht} at={at} pair={pair} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function SidePicker({ label, value, onChange, teams }: { label: string; value: string; onChange: (v: string) => void; teams: { code: string; name: string }[] }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-white/40 mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/60"
        style={{ color: "var(--fg)" }}
      >
        {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
      </select>
    </label>
  );
}

function WdlPanel({ pair, ht, at }: { pair: { pH: number; pD: number; pA: number }; ht: { name: string }; at: { name: string } }) {
  const { t } = useT();
  return (
    <div className="glass p-5">
      <div className="text-xs uppercase tracking-widest text-white/40 mb-4">{t("versus.wdl")}</div>
      <div className="flex h-3 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pair.pH * 100}%` }} transition={{ duration: 0.6 }} style={{ background: "#10e07d" }} />
        <motion.div initial={{ width: 0 }} animate={{ width: `${pair.pD * 100}%` }} transition={{ duration: 0.6, delay: 0.1 }} style={{ background: "#8e8e93" }} />
        <motion.div initial={{ width: 0 }} animate={{ width: `${pair.pA * 100}%` }} transition={{ duration: 0.6, delay: 0.2 }} style={{ background: "#ff3b5c" }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="text-white/40">{ht.name} {t("versus.win")}</div>
          <div className="text-base numeric font-semibold mt-0.5 text-accent-green">{(pair.pH * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-white/40">{t("versus.draw")}</div>
          <div className="text-base numeric font-semibold mt-0.5">{(pair.pD * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-white/40">{at.name} {t("versus.win")}</div>
          <div className="text-base numeric font-semibold mt-0.5 text-accent-red">{(pair.pA * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

function ComparePanel({ ht, at, pair }: { ht: { name: string; elo: number; group: string; confederation: string }; at: { name: string; elo: number; group: string; confederation: string }; pair: { lh: number; la: number } }) {
  const { t } = useT();
  const rows = [
    { label: t("versus.elo"), h: ht.elo.toFixed(0), a: at.elo.toFixed(0) },
    { label: t("versus.conf"), h: ht.confederation, a: at.confederation },
    { label: t("versus.group"), h: ht.group, a: at.group },
    { label: t("versus.xg"), h: pair.lh.toFixed(2), a: pair.la.toFixed(2) },
  ];
  return (
    <div className="glass p-5">
      <div className="text-xs uppercase tracking-widest text-white/40 mb-4">{t("versus.comparison")}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-white/5 last:border-0">
              <td className="py-2 text-right pr-3 numeric">{r.h}</td>
              <td className="py-2 px-3 text-xs uppercase tracking-widest text-white/40 text-center">{r.label}</td>
              <td className="py-2 pl-3 numeric">{r.a}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
