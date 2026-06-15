import { describe, it, expect } from "vitest";
import { buildCdf, fillR32, sampleScore, simulate } from "./engine";
import { makeRng } from "./rng";
import { applyAvailabilityScenario, applyDynamicScenario, tacticalVoidIndex } from "./scenarios";

describe("scoreline sampling", () => {
  const pair = { lh: 1.5, la: 1.1, pH: 0.5, pD: 0.25, pA: 0.25 };

  it("cdf is monotonic and ends at ~1", () => {
    const cdf = buildCdf(pair, -0.05);
    for (let i = 1; i < cdf.length; i++) expect(cdf[i]).toBeGreaterThanOrEqual(cdf[i - 1]);
    expect(cdf[cdf.length - 1]).toBeCloseTo(1, 6);
  });

  it("seeded RNG produces deterministic samples", () => {
    const cdf = buildCdf(pair, -0.05);
    const r1 = makeRng(123); const r2 = makeRng(123);
    for (let i = 0; i < 100; i++) {
      expect(sampleScore(cdf, r1())).toEqual(sampleScore(cdf, r2()));
    }
  });

  it("home win rate approximately matches mean", () => {
    const cdf = buildCdf(pair, -0.05);
    const rng = makeRng(42);
    let hWins = 0, n = 5000;
    for (let i = 0; i < n; i++) {
      const [h, a] = sampleScore(cdf, rng());
      if (h > a) hWins++;
    }
    // Expected ~ 50–55% for these lambdas
    expect(hWins / n).toBeGreaterThan(0.4);
    expect(hWins / n).toBeLessThan(0.7);
  });
});

describe("squad availability scenarios", () => {
  const pair = { lh: 1.6, la: 1.1, pH: 0.52, pD: 0.25, pA: 0.23 };

  it("reduces a team's attack when likely attacking starters are unavailable", () => {
    const adjusted = applyAvailabilityScenario(pair, { attackers: 2 }, undefined);
    expect(adjusted.lh).toBeLessThan(pair.lh);
    expect(adjusted.la).toBe(pair.la);
  });

  it("raises opponent scoring when a goalkeeper is unavailable", () => {
    const adjusted = applyAvailabilityScenario(pair, { goalkeeper: 1 }, undefined);
    expect(adjusted.la).toBeGreaterThan(pair.la);
  });

  it("caps extreme user inputs", () => {
    const adjusted = applyAvailabilityScenario(
      pair,
      { goalkeeper: 99, defenders: 99, midfielders: 99, attackers: 99, suspensions: 99 },
      undefined,
    );
    expect(adjusted.lh).toBeGreaterThanOrEqual(0.15);
    expect(adjusted.la).toBeLessThanOrEqual(5);
  });
});

describe("tactical stress scenarios", () => {
  const pair = { lh: 1.5, la: 1.2, pH: 0.46, pD: 0.27, pA: 0.27 };

  it("double midfield void weakens both attack and defence", () => {
    const adjusted = applyDynamicScenario(
      pair,
      undefined,
      undefined,
      { midfieldVoid: 2 },
      undefined,
    );
    expect(adjusted.lh).toBeLessThan(pair.lh);
    expect(adjusted.la).toBeGreaterThan(pair.la);
  });

  it("reports a bounded and monotonic Tactical Void Index", () => {
    const mild = tacticalVoidIndex({ midfielders: 1 }, { midfieldVoid: 1 });
    const severe = tacticalVoidIndex({ midfielders: 2 }, { midfieldVoid: 2 });
    expect(mild).toBeGreaterThan(0);
    expect(severe).toBeGreaterThan(mild);
    expect(tacticalVoidIndex(
      { goalkeeper: 9, defenders: 9, midfielders: 9, attackers: 9, suspensions: 9 },
      { midfieldVoid: 9, defensiveDisorganization: 9, attackingDisconnect: 9, pressingFailure: 9 },
    )).toBe(100);
  });
});

describe("completed matches", () => {
  it("uses the real score instead of a user constraint", () => {
    const allTeams = "ABCDEFGHIJKL".split("").flatMap((group) =>
      [0, 1, 2, 3].map((index) => ({
        code: `${group}${index}`,
        name: `${group}${index}`,
        iso2: "us",
        confederation: "TEST",
        host: false,
        group,
        elo: 1500,
      }))
    );
    const pairwise = Object.fromEntries(
      allTeams.flatMap((home) =>
        allTeams
          .filter((away) => away.code !== home.code)
          .map((away) => [
            `${home.code}-${away.code}`,
            { lh: 1, la: 1, pH: 0.34, pD: 0.32, pA: 0.34 },
          ])
      )
    );
    const schedule = "ABCDEFGHIJKL".split("").flatMap((group) => {
      const codes = allTeams.filter((team) => team.group === group).map((team) => team.code);
      return [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]].map(
        ([home, away], index) => ({
          id: `${group}${index}`,
          stage: "group" as const,
          group,
          date: "2026-06-11",
          home: codes[home],
          away: codes[away],
          neutral: true,
          completed: true,
          homeScore: home === 0 ? 9 : 0,
          awayScore: 0,
        })
      );
    });

    const result = simulate({
      teams: allTeams,
      schedule,
      pairwise,
      iterations: 1,
      seed: 1,
      constraints: { matchScore: { A0: [0, 9] } },
    });

    expect(result.expectedPoints.A0).toBe(9);
  });
});

describe("official Round-of-32 feeds", () => {
  it("resolves every possible set of eight third-place groups", () => {
    const letters = "ABCDEFGHIJKL".split("");
    const standings = Object.fromEntries(
      letters.map((group) => [
        group,
        [0, 1, 2, 3].map((index) => ({
          team: `${group}${index}`,
          played: 3,
          won: 0,
          drew: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          pts: 0,
        })),
      ])
    );
    const combinations: string[][] = [];
    function choose(start: number, selected: string[]) {
      if (selected.length === 8) {
        combinations.push(selected);
        return;
      }
      for (let index = start; index <= letters.length - (8 - selected.length); index++) {
        choose(index + 1, [...selected, letters[index]]);
      }
    }
    choose(0, []);

    expect(combinations).toHaveLength(495);
    for (const groups of combinations) {
      const ties = fillR32(standings, new Set(groups));
      expect(ties).toHaveLength(16);
      expect(ties.flat().every(Boolean)).toBe(true);
    }

    const annexRowOne = fillR32(standings, new Set("EFGHIJKL".split("")));
    expect(annexRowOne[0][1]).toBe("F2");
    expect(annexRowOne[1][1]).toBe("G2");
    expect(annexRowOne[6][1]).toBe("I2");
    expect(annexRowOne[7][1]).toBe("H2");
    expect(annexRowOne[10][1]).toBe("E2");
    expect(annexRowOne[11][1]).toBe("K2");
    expect(annexRowOne[14][1]).toBe("J2");
    expect(annexRowOne[15][1]).toBe("L2");
  });
});
