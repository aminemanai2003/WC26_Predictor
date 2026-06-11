"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { PairwiseEntry, Team } from "@/lib/types";
import { buildCdf } from "@/lib/sim/engine";
import TeamBadge from "./TeamBadge";
import { useT } from "@/lib/i18n/context";

type Props = {
  pair: PairwiseEntry;
  rho?: number;
  home: Team;
  away: Team;
};

export default function PredictedScoreboard({ pair, rho = -0.05, home, away }: Props) {
  const { t } = useT();
  const top = useMemo(() => {
    const cdf = buildCdf(pair, rho);
    const SIZE = Math.sqrt(cdf.length) | 0;
    const list: { h: number; a: number; p: number }[] = [];
    let prev = 0;
    for (let h = 0; h < SIZE; h++) {
      for (let a = 0; a < SIZE; a++) {
        const idx = h * SIZE + a;
        list.push({ h, a, p: cdf[idx] - prev });
        prev = cdf[idx];
      }
    }
    return list.sort((x, y) => y.p - x.p).slice(0, 6);
  }, [pair, rho]);

  const best = top[0];
  const alternates = top.slice(1, 6);

  return (
    <div className="glass p-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-50"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,200,87,0.15), transparent 60%)" }} />

      <div className="text-xs uppercase tracking-widest text-white/40 mb-5 text-center">
        {t("versus.mostLikelyScore")}
      </div>

      {/* Big scoreboard */}
      <motion.div
        key={`${home.code}-${away.code}-${best.h}-${best.a}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-4"
      >
        {/* Home side */}
        <div className="flex flex-col items-center sm:items-end gap-2 text-center sm:text-right">
          <span
            aria-hidden
            className={`fi fi-${home.iso2} rounded-sm overflow-hidden shadow-sm`}
            style={{ display: "inline-block", aspectRatio: "4/3", width: "3.25rem" }}
          />
          <div className="text-sm font-medium leading-tight">{home.name}</div>
        </div>

        {/* Score */}
        <div
          className="flex items-center gap-3 sm:gap-5 px-3 sm:px-6 py-3 rounded-2xl border"
          style={{
            background: "color-mix(in srgb, var(--fg) 6%, transparent)",
            borderColor: "var(--border)",
          }}
        >
          <span className="text-5xl sm:text-6xl font-semibold numeric tabular-nums tracking-tighter">{best.h}</span>
          <span className="text-2xl text-white/30 font-light">–</span>
          <span className="text-5xl sm:text-6xl font-semibold numeric tabular-nums tracking-tighter">{best.a}</span>
        </div>

        {/* Away side */}
        <div className="flex flex-col items-center sm:items-start gap-2 text-center sm:text-left">
          <span
            aria-hidden
            className={`fi fi-${away.iso2} rounded-sm overflow-hidden shadow-sm`}
            style={{ display: "inline-block", aspectRatio: "4/3", width: "3.25rem" }}
          />
          <div className="text-sm font-medium leading-tight">{away.name}</div>
        </div>
      </motion.div>

      {/* Confidence bar */}
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-white/50">
        <span className="numeric font-semibold text-accent-gold">{(best.p * 100).toFixed(1)}%</span>
        <span>·</span>
        <span>{t("versus.xg")}: <span className="numeric">{pair.lh.toFixed(2)} – {pair.la.toFixed(2)}</span></span>
      </div>

      {/* Alternates */}
      <div className="mt-6 pt-5 border-t border-white/5">
        <div className="text-xs uppercase tracking-widest text-white/40 mb-3">
          {t("versus.alternativeScores")}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {alternates.map((s, i) => (
            <motion.div
              key={`${s.h}-${s.a}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              className="rounded-md bg-white/5 border border-white/5 px-2 py-2 text-center"
              title={`${home.name} ${s.h}–${s.a} ${away.name} · ${(s.p * 100).toFixed(2)}%`}
            >
              <div className="numeric text-base font-semibold">{s.h}–{s.a}</div>
              <div className="numeric text-[10px] text-white/40 mt-0.5">{(s.p * 100).toFixed(1)}%</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
