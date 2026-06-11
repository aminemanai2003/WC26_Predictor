"use client";
import { motion } from "framer-motion";
import type { Team } from "@/lib/types";
import TeamBadge from "./TeamBadge";

type Props = {
  data: { team: Team; p: number }[];
  max?: number;
};

export default function ChampionRace({ data, max = 10 }: Props) {
  const top = data.slice(0, max);
  const m = top[0]?.p || 1;
  return (
    <div className="space-y-3">
      {top.map((row, i) => (
        <motion.div
          key={row.team.code}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04, duration: 0.4 }}
          className="grid grid-cols-[1.5rem_minmax(0,11rem)_1fr_3.5rem] items-center gap-3"
        >
          <span className="text-white/40 numeric text-sm">#{i + 1}</span>
          <TeamBadge team={row.team} size="md" />
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(row.p / m) * 100}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, #10e07d 0%, ${i < 3 ? "#ffc857" : "#4d8dff"} 100%)`,
              }}
            />
          </div>
          <span className="text-right numeric text-sm font-medium">{(row.p * 100).toFixed(1)}%</span>
        </motion.div>
      ))}
    </div>
  );
}
