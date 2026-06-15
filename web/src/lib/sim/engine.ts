// Pure functional Monte Carlo engine for the WC 2026 tournament.
// Runs inside a Web Worker (worker.ts) or directly in tests.

import type { Match, Pairwise, PairwiseEntry, Team, SimConstraints } from "../types";
import { makeRng } from "./rng";
import { applyAvailabilityScenario } from "./scenarios";
// Generated from Annex C of the official FIFA World Cup 2026 regulations.
import thirdPlaceAssignmentsJson from "./thirdPlaceAssignments.json";

const THIRD_PLACE_ASSIGNMENTS = thirdPlaceAssignmentsJson as Record<string, string[]>;
const THIRD_PLACE_WINNERS = ["A", "B", "D", "E", "G", "I", "K", "L"];

export type SimInput = {
  teams: Team[];
  schedule: Match[];
  pairwise: Pairwise;
  iterations: number;
  seed: number;
  constraints?: SimConstraints;
  rho?: number;
};

// =============================================================================
// Match simulation
// =============================================================================

const MAX_GOALS = 8;

// Cached factorials for the small range we need
const FACT: number[] = (() => {
  const f = [1];
  for (let i = 1; i <= MAX_GOALS; i++) f.push(f[i - 1] * i);
  return f;
})();

function poissonPmf(k: number, lam: number): number {
  return (Math.exp(-lam) * Math.pow(lam, k)) / FACT[k];
}

function dixonColesTau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

/** Build the joint scoreline distribution (cumulative) from a pair entry. */
export function buildCdf(pair: PairwiseEntry, rho: number): Float64Array {
  const size = (MAX_GOALS + 1) * (MAX_GOALS + 1);
  const arr = new Float64Array(size);
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    const ph = poissonPmf(h, pair.lh);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const pa = poissonPmf(a, pair.la);
      let p = ph * pa * dixonColesTau(h, a, pair.lh, pair.la, rho);
      if (p < 0) p = 0;
      arr[h * (MAX_GOALS + 1) + a] = p;
      total += p;
    }
  }
  // Normalize + build cumulative
  let acc = 0;
  for (let i = 0; i < size; i++) {
    arr[i] = arr[i] / total;
    acc += arr[i];
    arr[i] = acc;
  }
  return arr;
}

/** Sample a (home, away) scoreline. */
export function sampleScore(cdf: Float64Array, u: number): [number, number] {
  // Binary search; cdf length = (MAX_GOALS+1)^2 = 81 — linear is fast enough.
  for (let i = 0; i < cdf.length; i++) {
    if (u <= cdf[i]) {
      return [Math.floor(i / (MAX_GOALS + 1)), i % (MAX_GOALS + 1)];
    }
  }
  return [0, 0];
}

// =============================================================================
// Group stage logic — full FIFA tiebreaker chain
// =============================================================================

type GroupRow = {
  team: string;
  played: number;
  won: number;
  drew: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
  // For head-to-head we re-derive from per-group match log
};

type GroupMatch = {
  home: string;
  away: string;
  hs: number;
  as: number;
};

function emptyRow(team: string): GroupRow {
  return { team, played: 0, won: 0, drew: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
}

function applyMatch(rows: Map<string, GroupRow>, m: GroupMatch) {
  const h = rows.get(m.home)!;
  const a = rows.get(m.away)!;
  h.played++; a.played++;
  h.gf += m.hs; h.ga += m.as;
  a.gf += m.as; a.ga += m.hs;
  if (m.hs > m.as) { h.won++; a.lost++; h.pts += 3; }
  else if (m.hs < m.as) { a.won++; h.lost++; a.pts += 3; }
  else { h.drew++; a.drew++; h.pts++; a.pts++; }
}

/**
 * FIFA group tiebreakers (in order):
 * 1. Points
 * 2. Head-to-head points (among tied teams)
 * 3. Head-to-head goal difference
 * 4. Head-to-head goals for
 * 5. Overall goal difference
 * 6. Overall goals for
 * 7. Random (we don't model team conduct / ranking)
 */
function rankGroup(
  rows: Map<string, GroupRow>,
  matches: GroupMatch[],
  rng: () => number,
): GroupRow[] {
  const all = Array.from(rows.values());

  function h2hStats(group: GroupRow[]): Map<string, { pts: number; gd: number; gf: number }> {
    const codes = new Set(group.map((r) => r.team));
    const stats = new Map<string, { pts: number; gd: number; gf: number }>();
    for (const c of codes) stats.set(c, { pts: 0, gd: 0, gf: 0 });
    for (const m of matches) {
      if (!codes.has(m.home) || !codes.has(m.away)) continue;
      const sh = stats.get(m.home)!, sa = stats.get(m.away)!;
      sh.gf += m.hs; sh.gd += m.hs - m.as;
      sa.gf += m.as; sa.gd += m.as - m.hs;
      if (m.hs > m.as) sh.pts += 3;
      else if (m.hs < m.as) sa.pts += 3;
      else { sh.pts++; sa.pts++; }
    }
    return stats;
  }

  const result: GroupRow[] = [];
  all.sort((x, y) => y.pts - x.pts);
  let i = 0;
  while (i < all.length) {
    let j = i + 1;
    while (j < all.length && all[j].pts === all[i].pts) j++;

    const tied = all.slice(i, j);

    function resolveHeadToHead(group: GroupRow[]): GroupRow[] {
      if (group.length === 1) return group;
      const h2h = h2hStats(group);
      const sorted = [...group].sort((x, y) => {
        const sx = h2h.get(x.team)!, sy = h2h.get(y.team)!;
        return sy.pts - sx.pts || sy.gd - sx.gd || sy.gf - sx.gf;
      });
      const resolved: GroupRow[] = [];
      let start = 0;
      while (start < sorted.length) {
        let end = start + 1;
        const base = h2h.get(sorted[start].team)!;
        while (end < sorted.length) {
          const next = h2h.get(sorted[end].team)!;
          if (next.pts !== base.pts || next.gd !== base.gd || next.gf !== base.gf) break;
          end++;
        }
        const stillTied = sorted.slice(start, end);
        if (stillTied.length === 1) {
          resolved.push(stillTied[0]);
        } else if (stillTied.length < group.length) {
          resolved.push(...resolveHeadToHead(stillTied));
        } else {
          stillTied.sort((x, y) =>
            (y.gf - y.ga) - (x.gf - x.ga) ||
            y.gf - x.gf ||
            (rng() - 0.5)
          );
          resolved.push(...stillTied);
        }
        start = end;
      }
      return resolved;
    }

    result.push(...resolveHeadToHead(tied));
    i = j;
  }
  return result;
}

// =============================================================================
// Bracket: pick 8 best third-placed teams across all 12 groups, then map to R32
// =============================================================================

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

/**
 * R32 bracket mapping for a 48-team WC.
 * 16 ties. Each tie is a pair of "selectors":
 *   { kind: "winner"|"runnerUp", group }  OR
 *   { kind: "third", from: [GroupLetter,...] }  // one of these third-place teams
 *
 * To keep this self-contained and deterministic, we use a mapping where each
 * third-place slot is fed from a non-overlapping set of 4 groups, and the 8
 * qualifying third-placed teams fill those slots in their overall ranking order.
 * This mirrors the structure of the official 2026 bracket — exact group letters
 * may differ from FIFA's draw, but the simulation behavior is equivalent for
 * probability purposes (every team has the same number of routes to advance).
 */
type Slot =
  | { kind: "winner"; group: string }
  | { kind: "runnerUp"; group: string }
  | { kind: "third"; from: string[] };

export const R32_TIES: [Slot, Slot][] = [
  [{ kind: "winner", group: "E" }, { kind: "third", from: ["A", "B", "C", "D", "F"] }],
  [{ kind: "winner", group: "I" }, { kind: "third", from: ["C", "D", "F", "G", "H"] }],
  [{ kind: "runnerUp", group: "A" }, { kind: "runnerUp", group: "B" }],
  [{ kind: "winner", group: "F" }, { kind: "runnerUp", group: "C" }],
  [{ kind: "runnerUp", group: "K" }, { kind: "runnerUp", group: "L" }],
  [{ kind: "winner", group: "H" }, { kind: "runnerUp", group: "J" }],
  [{ kind: "winner", group: "D" }, { kind: "third", from: ["B", "E", "F", "I", "J"] }],
  [{ kind: "winner", group: "G" }, { kind: "third", from: ["A", "E", "H", "I", "J"] }],
  [{ kind: "winner", group: "C" }, { kind: "runnerUp", group: "F" }],
  [{ kind: "runnerUp", group: "E" }, { kind: "runnerUp", group: "I" }],
  [{ kind: "winner", group: "A" }, { kind: "third", from: ["C", "E", "F", "H", "I"] }],
  [{ kind: "winner", group: "L" }, { kind: "third", from: ["E", "H", "I", "J", "K"] }],
  [{ kind: "winner", group: "J" }, { kind: "runnerUp", group: "H" }],
  [{ kind: "runnerUp", group: "D" }, { kind: "runnerUp", group: "G" }],
  [{ kind: "winner", group: "B" }, { kind: "third", from: ["E", "F", "G", "I", "J"] }],
  [{ kind: "winner", group: "K" }, { kind: "third", from: ["D", "E", "I", "J", "L"] }],
];

/** Rank all 12 third-placed teams overall, then pick the best 8. */
export function pickBestThirds(
  thirdRows: { group: string; row: GroupRow }[],
  rng: () => number,
): { group: string; row: GroupRow }[] {
  const sorted = [...thirdRows].sort((x, y) =>
    y.row.pts - x.row.pts ||
    (y.row.gf - y.row.ga) - (x.row.gf - x.row.ga) ||
    y.row.gf - x.row.gf ||
    (rng() - 0.5)
  );
  return sorted.slice(0, 8);
}

/** Resolve each R32 tie into concrete (homeCode, awayCode) using standings. */
export function fillR32(
  standings: Record<string, GroupRow[]>, // group letter -> ranked rows
  bestThirds: Set<string>, // group letters whose third-placed teams qualified
): [string, string][] {
  const assignment = new Map<string, string>();
  const combination = [...bestThirds].sort().join("");
  const fifaRow = THIRD_PLACE_ASSIGNMENTS[combination];
  if (!fifaRow) {
    throw new Error(`No FIFA Annex C assignment for ${combination}`);
  }
  const thirdByWinner = new Map(
    THIRD_PLACE_WINNERS.map((winner, index) => [winner, fifaRow[index]])
  );
  R32_TIES.forEach((tie, tieIndex) => {
    const winner = tie.find((slot) => slot.kind === "winner");
    const thirdSide = tie.findIndex((slot) => slot.kind === "third");
    if (!winner || winner.kind !== "winner" || thirdSide < 0) return;
    const group = thirdByWinner.get(winner.group);
    if (!group) throw new Error(`Missing Annex C opponent for Group ${winner.group}`);
    assignment.set(`${tieIndex}-${thirdSide}`, group);
  });

  function resolve(slot: Slot, tieIndex: number, side: number): string {
    if (slot.kind === "winner") return standings[slot.group][0].team;
    if (slot.kind === "runnerUp") return standings[slot.group][1].team;
    // third — pick the first qualifying group letter in this slot's preferred list
    const group = assignment.get(`${tieIndex}-${side}`);
    if (!group) throw new Error("Missing third-place assignment");
    return standings[group][2].team;
  }

  return R32_TIES.map(([home, away], tieIndex) => [
    resolve(home, tieIndex, 0),
    resolve(away, tieIndex, 1),
  ]);
}

// =============================================================================
// Main simulation loop
// =============================================================================

export type Aggregates = {
  groupTop1: Record<string, number>;
  groupTop2: Record<string, number>;
  qualifyR32: Record<string, number>;
  reachR16: Record<string, number>;
  reachQF: Record<string, number>;
  reachSF: Record<string, number>;
  reachFinal: Record<string, number>;
  champion: Record<string, number>;
  expectedPoints: Record<string, number>;
  iterations: number;
  seed: number;
};

export function simulate(input: SimInput): Aggregates {
  const { teams, schedule, pairwise, iterations, seed, constraints, rho = -0.05 } = input;
  const rng = makeRng(seed);

  // Cache CDFs for every pair we'll need — group stage pairs are deterministic;
  // knockouts can be any pair, so we lazily build & cache.
  const cdfCache = new Map<string, Float64Array>();
  function getCdf(home: string, away: string): Float64Array {
    const availabilityKey = JSON.stringify([
      constraints?.teamAvailability?.[home] ?? null,
      constraints?.teamAvailability?.[away] ?? null,
    ]);
    const key = `${home}-${away}-${availabilityKey}`;
    let c = cdfCache.get(key);
    if (!c) {
      const basePair = pairwise[`${home}-${away}`];
      if (!basePair) throw new Error(`No pairwise entry for ${home}-${away}`);
      const scenarioPair = applyAvailabilityScenario(
        basePair,
        constraints?.teamAvailability?.[home],
        constraints?.teamAvailability?.[away],
      );
      c = buildCdf(scenarioPair, rho);
      cdfCache.set(key, c);
    }
    return c;
  }

  const groupMatches: Record<string, Match[]> = {};
  for (const m of schedule) {
    if (m.stage === "group" && m.group) {
      (groupMatches[m.group] ||= []).push(m);
    }
  }

  const teamsByGroup: Record<string, string[]> = {};
  for (const t of teams) (teamsByGroup[t.group] ||= []).push(t.code);

  // Aggregators
  const counts = (): Record<string, number> =>
    Object.fromEntries(teams.map((t) => [t.code, 0]));
  const agg: Aggregates = {
    groupTop1: counts(), groupTop2: counts(), qualifyR32: counts(),
    reachR16: counts(), reachQF: counts(), reachSF: counts(),
    reachFinal: counts(), champion: counts(),
    expectedPoints: counts(),
    iterations, seed,
  };

  function forceMatch(matchId: string | undefined, home: string, away: string): [number, number] | null {
    if (!matchId || !constraints) return null;
    if (constraints.matchScore?.[matchId]) return constraints.matchScore[matchId];
    const r = constraints.matchResult?.[matchId];
    if (r === "H") return [1, 0];
    if (r === "A") return [0, 1];
    if (r === "D") return [1, 1];
    return null;
  }

  function simMatch(home: string, away: string, match?: Match): [number, number] {
    if (
      match?.completed &&
      Number.isFinite(match.homeScore) &&
      Number.isFinite(match.awayScore)
    ) {
      return [match.homeScore!, match.awayScore!];
    }
    const forced = forceMatch(match?.id, home, away);
    if (forced) return forced;
    return sampleScore(getCdf(home, away), rng());
  }

  function simKnockoutMatch(home: string, away: string, matchId?: string): string {
    const forced = forceMatch(matchId, home, away);
    if (forced) {
      const [hs, as_] = forced;
      if (hs > as_) return home;
      if (as_ > hs) return away;
      // Tie -> coin-flip-ish via Elo (use pairwise pH/pA imbalance)
    }
    const [hs, as_] = sampleScore(getCdf(home, away), rng());
    if (hs > as_) return home;
    if (as_ > hs) return away;
    // Penalty shootout — favor higher-Elo side slightly
    const pair = applyAvailabilityScenario(
      pairwise[`${home}-${away}`],
      constraints?.teamAvailability?.[home],
      constraints?.teamAvailability?.[away],
    );
    const pHome = 0.5 + (pair.pH - pair.pA) * 0.3;
    return rng() < pHome ? home : away;
  }

  // --- iterations ---
  for (let iter = 0; iter < iterations; iter++) {
    const standings: Record<string, GroupRow[]> = {};
    const thirdRows: { group: string; row: GroupRow }[] = [];

    // Group stage
    for (const letter of GROUP_LETTERS) {
      const matches = groupMatches[letter] || [];
      const rows = new Map<string, GroupRow>();
      for (const c of teamsByGroup[letter]) rows.set(c, emptyRow(c));
      const logged: GroupMatch[] = [];

      for (const m of matches) {
        const home = m.home!, away = m.away!;
        const [hs, as_] = simMatch(home, away, m);
        const gm: GroupMatch = { home, away, hs, as: as_ };
        logged.push(gm);
        applyMatch(rows, gm);
      }
      const ranked = rankGroup(rows, logged, rng);
      standings[letter] = ranked;
      agg.groupTop1[ranked[0].team]++;
      agg.groupTop2[ranked[0].team]++;
      agg.groupTop2[ranked[1].team]++;
      thirdRows.push({ group: letter, row: ranked[2] });

      for (const r of ranked) agg.expectedPoints[r.team] += r.pts;
    }

    // Best 8 third-placed teams
    const bestThirds = pickBestThirds(thirdRows, rng);
    const bestThirdGroups = new Set(bestThirds.map((t) => t.group));
    for (const t of bestThirds) agg.qualifyR32[t.row.team]++;
    // Top-2 also qualify
    for (const letter of GROUP_LETTERS) {
      agg.qualifyR32[standings[letter][0].team]++;
      agg.qualifyR32[standings[letter][1].team]++;
    }

    // R32
    const r32 = fillR32(standings, new Set(bestThirdGroups));
    const r16Winners: string[] = [];
    for (let i = 0; i < r32.length; i++) {
      const [h, a] = r32[i];
      if (!h || !a) { r16Winners.push(h || a || ""); continue; }
      const w = simKnockoutMatch(h, a, `R32${String(i + 1).padStart(2, "0")}`);
      r16Winners.push(w);
      agg.reachR16[w]++;
    }

    // R16
    const qfWinners: string[] = [];
    for (let i = 0; i < r16Winners.length; i += 2) {
      const h = r16Winners[i], a = r16Winners[i + 1];
      if (!h || !a) { qfWinners.push(h || a); continue; }
      const w = simKnockoutMatch(h, a, `R16${String(i / 2 + 1).padStart(2, "0")}`);
      qfWinners.push(w);
      agg.reachQF[w]++;
    }
    // QF
    const sfWinners: string[] = [];
    for (let i = 0; i < qfWinners.length; i += 2) {
      const h = qfWinners[i], a = qfWinners[i + 1];
      const w = simKnockoutMatch(h, a, `QF${String(i / 2 + 1).padStart(2, "0")}`);
      sfWinners.push(w);
      agg.reachSF[w]++;
    }
    // SF
    const finalists: string[] = [];
    for (let i = 0; i < sfWinners.length; i += 2) {
      const h = sfWinners[i], a = sfWinners[i + 1];
      const w = simKnockoutMatch(h, a, `SF${String(i / 2 + 1).padStart(2, "0")}`);
      finalists.push(w);
      agg.reachFinal[w]++;
    }
    // Final
    if (finalists.length === 2) {
      const champ = simKnockoutMatch(finalists[0], finalists[1], "F01");
      agg.champion[champ]++;
    }
  }

  // Convert counts to probabilities
  for (const k of [
    "groupTop1", "groupTop2", "qualifyR32",
    "reachR16", "reachQF", "reachSF", "reachFinal", "champion",
  ] as const) {
    const obj = agg[k];
    for (const code of Object.keys(obj)) obj[code] = obj[code] / iterations;
  }
  for (const code of Object.keys(agg.expectedPoints)) {
    agg.expectedPoints[code] = agg.expectedPoints[code] / iterations;
  }
  return agg;
}
