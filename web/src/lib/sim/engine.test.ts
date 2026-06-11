import { describe, it, expect } from "vitest";
import { buildCdf, sampleScore } from "./engine";
import { makeRng } from "./rng";

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
