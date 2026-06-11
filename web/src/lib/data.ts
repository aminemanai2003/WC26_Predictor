import type { Team, Match, Pairwise, Meta } from "./types";

// These imports are static — Next.js inlines them at build time.
import teamsJson from "../../public/data/teams.json";
import scheduleJson from "../../public/data/schedule.json";
import metaJson from "../../public/data/meta.json";

export const teams = teamsJson as Team[];
export const schedule = scheduleJson as Match[];
export const meta = metaJson as Meta;

export const teamByCode: Record<string, Team> = Object.fromEntries(
  teams.map((t) => [t.code, t])
);

export const teamsByGroup: Record<string, Team[]> = teams.reduce(
  (acc, t) => {
    (acc[t.group] ||= []).push(t);
    return acc;
  },
  {} as Record<string, Team[]>
);

// Fetched at runtime (it's a 200KB file — keep it out of the JS bundle)
let _pairwise: Pairwise | null = null;
export async function getPairwise(): Promise<Pairwise> {
  if (_pairwise) return _pairwise;
  const res = await fetch("/data/pairwise.json");
  _pairwise = (await res.json()) as Pairwise;
  return _pairwise;
}

export function pairKey(home: string, away: string) {
  return `${home}-${away}`;
}
