"use client";
import { useMemo } from "react";
import type { PairwiseEntry } from "@/lib/types";
import { buildCdf } from "@/lib/sim/engine";

type Props = {
  pair: PairwiseEntry;
  rho?: number;
  homeName: string;
  awayName: string;
  maxGoals?: number;
};

export default function ScorelineHeatmap({ pair, rho = -0.05, homeName, awayName, maxGoals = 6 }: Props) {
  const matrix = useMemo(() => {
    // Reconstruct individual cell probabilities from the CDF
    const cdf = buildCdf(pair, rho);
    const SIZE = Math.sqrt(cdf.length) | 0;
    const m: number[][] = [];
    let prev = 0;
    for (let h = 0; h < SIZE; h++) {
      m[h] = [];
      for (let a = 0; a < SIZE; a++) {
        const idx = h * SIZE + a;
        m[h][a] = cdf[idx] - prev;
        prev = cdf[idx];
      }
    }
    return m;
  }, [pair, rho]);

  const cells = matrix.slice(0, maxGoals + 1).map((row) => row.slice(0, maxGoals + 1));
  const flat = cells.flat();
  const max = Math.max(...flat);

  // Pick the top-5 scorelines for the "most likely scores" list
  const top = useMemo(() => {
    const list: { h: number; a: number; p: number }[] = [];
    for (let h = 0; h < cells.length; h++)
      for (let a = 0; a < cells[h].length; a++) list.push({ h, a, p: cells[h][a] });
    return list.sort((x, y) => y.p - x.p).slice(0, 5);
  }, [cells]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              <th colSpan={maxGoals + 1} className="text-xs text-white/40 font-normal pb-1">{awayName} →</th>
            </tr>
            <tr>
              <th className="text-xs text-white/40 font-normal pr-2">↓ {homeName}</th>
              {Array.from({ length: maxGoals + 1 }).map((_, a) => (
                <th key={a} className="w-9 text-xs text-white/40 font-medium">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, h) => (
              <tr key={h}>
                <th className="text-xs text-white/40 font-medium pr-2 text-right">{h}</th>
                {row.map((p, a) => {
                  const ratio = p / max;
                  const isDiag = h === a;
                  const isHomeWin = h > a;
                  const baseColor = isDiag ? "rgba(142,142,147" : isHomeWin ? "rgba(16,224,125" : "rgba(255,59,92";
                  return (
                    <td
                      key={a}
                      className="w-9 h-9 text-center text-[10px] numeric rounded-md transition-transform hover:scale-110 cursor-default relative"
                      style={{
                        background: `${baseColor},${Math.max(0.06, ratio * 0.85)})`,
                        color: ratio > 0.5 ? "#06080f" : "var(--fg)",
                        fontWeight: ratio > 0.5 ? 600 : 400,
                      }}
                      title={`${homeName} ${h}-${a} ${awayName} · ${(p * 100).toFixed(2)}%`}
                    >
                      {(p * 100).toFixed(p > 0.05 ? 0 : 1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Most likely scorelines</div>
        <div className="flex flex-wrap gap-2">
          {top.map((t, i) => (
            <div
              key={i}
              className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs flex items-center gap-2"
            >
              <span className="numeric font-medium">{t.h}–{t.a}</span>
              <span className="text-white/40 numeric">{(t.p * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
