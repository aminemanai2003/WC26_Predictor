"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Section } from "@/components/Section";
import TeamBadge from "@/components/TeamBadge";
import ChampionRace from "@/components/ChampionRace";
import { teamByCode, schedule, teams } from "@/lib/data";
import { useSimulation } from "@/lib/sim/useSimulation";
import type { SimConstraints, SquadAvailability } from "@/lib/types";
import { availabilityCount, EMPTY_AVAILABILITY } from "@/lib/sim/scenarios";
import { Play, RotateCcw, Sparkles, Dices } from "lucide-react";
import { useT } from "@/lib/i18n/context";

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

export default function SimulatorPage() {
  const { t } = useT();
  const { result, run, status, elapsedMs } = useSimulation();
  const [iterations, setIterations] = useState(10000);
  const [seed, setSeed] = useState(42);
  const [constraints, setConstraints] = useState<SimConstraints>({ matchResult: {} });
  const [selectedGroup, setSelectedGroup] = useState("A");
  const [availabilityTeam, setAvailabilityTeam] = useState("ARG");

  useEffect(() => { run({ iterations, seed, constraints }); }, []); // eslint-disable-line

  const groupMatches = useMemo(
    () => schedule.filter((m) => m.stage === "group" && m.group === selectedGroup),
    [selectedGroup]
  );

  const top10 = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.champion)
      .map(([code, p]) => ({ team: teamByCode[code], p }))
      .filter((r) => r.team)
      .sort((a, b) => b.p - a.p)
      .slice(0, 10);
  }, [result]);

  const constraintCount =
    Object.keys(constraints.matchResult || {}).length +
    Object.values(constraints.teamAvailability || {}).reduce(
      (sum, value) => sum + availabilityCount(value),
      0,
    );

  function setOutcome(matchId: string, outcome: "H" | "D" | "A" | null) {
    setConstraints((prev) => {
      const mr = { ...(prev.matchResult || {}) };
      if (outcome === null) delete mr[matchId];
      else mr[matchId] = outcome;
      return { ...prev, matchResult: mr };
    });
  }

  function setAvailability(field: keyof SquadAvailability, value: number) {
    setConstraints((prev) => {
      const teamAvailability = { ...(prev.teamAvailability || {}) };
      const current = teamAvailability[availabilityTeam] || EMPTY_AVAILABILITY;
      const next = { ...current, [field]: value };
      if (availabilityCount(next) === 0) delete teamAvailability[availabilityTeam];
      else teamAvailability[availabilityTeam] = next;
      return { ...prev, teamAvailability };
    });
  }

  function reset() { setConstraints({ matchResult: {}, teamAvailability: {} }); }
  function runSim() { run({ iterations, seed, constraints }); }
  function reroll() { const s = Math.floor(Math.random() * 1e9); setSeed(s); run({ iterations, seed: s, constraints }); }

  return (
    <Section title={t("sim.title")} description={t("sim.desc")}>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* LEFT: constraints */}
        <div className="glass p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-sm font-semibold">{t("sim.fixOutcomes")}</div>
            <div className="text-xs text-white/40">
              {t(constraintCount === 1 ? "sim.constraints" : "sim.constraintsPlural", { n: constraintCount })}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {GROUP_LETTERS.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`w-8 h-8 text-xs rounded-md ${selectedGroup === g ? "bg-accent-green text-ink-950 font-semibold" : "bg-white/5 hover:bg-white/10 text-white/60"}`}
              >{g}</button>
            ))}
          </div>

          <p className="text-xs text-white/40 mb-3">{t("sim.help")}</p>
          <div className="space-y-2">
            {groupMatches.map((m) => {
              const ht = teamByCode[m.home!]; const at = teamByCode[m.away!];
              const current = constraints.matchResult?.[m.id];
              const completed = m.completed && m.homeScore !== undefined && m.awayScore !== undefined;
              return (
                <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-2 rounded-md hover:bg-white/5">
                  <button
                    onClick={() => setOutcome(m.id, current === "H" ? null : "H")}
                    title={t("sim.forceWin", { team: ht.name })}
                    disabled={completed}
                    className={`flex items-center gap-2 justify-end text-sm rounded-md px-2 py-1.5 border transition-colors disabled:cursor-default ${
                      current === "H"
                        ? "bg-accent-green/20 border-accent-green/50 text-white"
                        : "border-white/5 hover:border-accent-green/30 hover:bg-accent-green/5 text-white/80"
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest text-white/40">{t("sim.winLabel")}</span>
                    <TeamBadge team={ht} size="sm" />
                  </button>
                  {completed ? (
                    <span className="numeric text-sm font-semibold px-3 py-1.5 rounded-md border border-accent-green/30 bg-accent-green/10">
                      {m.homeScore}-{m.awayScore}
                    </span>
                  ) : (
                    <button
                      onClick={() => setOutcome(m.id, current === "D" ? null : "D")}
                      title={t("sim.forceDraw")}
                      className={`text-[10px] font-semibold tracking-widest px-3 py-1.5 rounded-md border transition-colors ${
                        current === "D"
                          ? "bg-white/15 border-white/40 text-white"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20 text-white/50"
                      }`}
                    >{t("sim.drawLabel")}</button>
                  )}
                  <button
                    onClick={() => setOutcome(m.id, current === "A" ? null : "A")}
                    title={t("sim.forceWin", { team: at.name })}
                    disabled={completed}
                    className={`flex items-center gap-2 text-sm rounded-md px-2 py-1.5 border transition-colors disabled:cursor-default ${
                      current === "A"
                        ? "bg-accent-red/20 border-accent-red/50 text-white"
                        : "border-white/5 hover:border-accent-red/30 hover:bg-accent-red/5 text-white/80"
                    }`}
                  >
                    <TeamBadge team={at} size="sm" />
                    <span className="text-[9px] uppercase tracking-widest text-white/40">{t("sim.winLabel")}</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold">{t("sim.squadStress")}</div>
                <p className="text-xs text-white/40 mt-1">{t("sim.squadStressHelp")}</p>
              </div>
              <select
                value={availabilityTeam}
                onChange={(event) => setAvailabilityTeam(event.target.value)}
                className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs"
                style={{ color: "var(--fg)" }}
              >
                {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map((team) => (
                  <option key={team.code} value={team.code}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {([
                ["goalkeeper", t("sim.goalkeeper"), 1],
                ["defenders", t("sim.defenders"), 3],
                ["midfielders", t("sim.midfielders"), 3],
                ["attackers", t("sim.attackers"), 3],
                ["suspensions", t("sim.suspensions"), 4],
              ] as [keyof SquadAvailability, string, number][]).map(([field, label, maximum]) => {
                const value = constraints.teamAvailability?.[availabilityTeam]?.[field] || 0;
                return (
                  <label key={field} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.03] px-3 py-2">
                    <span className="text-xs text-white/60">{label}</span>
                    <select
                      value={value}
                      onChange={(event) => setAvailability(field, Number(event.target.value))}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs numeric"
                      style={{ color: "var(--fg)" }}
                    >
                      {Array.from({ length: maximum + 1 }, (_, index) => (
                        <option key={index} value={index}>{index}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center gap-3">
            <label className="text-xs text-white/60 flex items-center gap-2">
              {t("common.iterations")}
              <select value={iterations} onChange={(e) => setIterations(+e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs" style={{ color: "var(--fg)" }}>
                <option value={2000}>2,000</option>
                <option value={5000}>5,000</option>
                <option value={10000}>10,000</option>
                <option value={20000}>20,000</option>
              </select>
            </label>
            <span className="text-xs text-white/40">{t("common.seed")} <span className="numeric">{seed}</span></span>
            <div className="ml-auto flex gap-2">
              <button onClick={reset} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-xs hover:bg-white/5">
                <RotateCcw className="h-3.5 w-3.5" /> {t("common.reset")}
              </button>
              <button onClick={reroll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-xs hover:bg-white/5">
                <Dices className="h-3.5 w-3.5" /> {t("common.reroll")}
              </button>
              <button
                onClick={runSim}
                disabled={status === "running" || status === "loading"}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-accent-green text-ink-950 text-xs font-semibold hover:shadow-glow disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" /> {t("common.simulate")}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: results */}
        <div className="glass p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-sm font-semibold">{t("sim.championProb")}</div>
            <div className="text-xs text-white/40">
              {status === "running" || status === "loading" ? (
                <span className="inline-flex items-center gap-1.5 text-accent-green"><Sparkles className="h-3 w-3 animate-pulse" /> {t("common.simulating")}</span>
              ) : result ? (
                <>{result.iterations.toLocaleString()} {t("common.simulations")} · {(elapsedMs / 1000).toFixed(2)}{t("common.seconds")}</>
              ) : "—"}
            </div>
          </div>
          {result ? (
            <motion.div key={JSON.stringify(constraints) + seed} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ChampionRace data={top10} />
            </motion.div>
          ) : (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-7 rounded-md bg-white/5" />)}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
