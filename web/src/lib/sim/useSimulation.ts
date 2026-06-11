"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Pairwise, SimConstraints } from "../types";
import { teams, schedule, getPairwise, meta } from "../data";
import type { Aggregates } from "./engine";

export type SimRunOptions = {
  iterations?: number;
  seed?: number;
  constraints?: SimConstraints;
};

export type SimStatus = "idle" | "loading" | "running" | "done" | "error";

export function useSimulation() {
  const workerRef = useRef<Worker | null>(null);
  const pairwiseRef = useRef<Pairwise | null>(null);
  const [status, setStatus] = useState<SimStatus>("idle");
  const [result, setResult] = useState<Aggregates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    return () => { w.terminate(); workerRef.current = null; };
  }, []);

  const run = useCallback(async (opts: SimRunOptions = {}) => {
    const { iterations = 10000, seed = Math.floor(Math.random() * 1e9), constraints } = opts;
    setStatus("loading");
    setError(null);
    try {
      if (!pairwiseRef.current) pairwiseRef.current = await getPairwise();
      const w = workerRef.current!;
      const t0 = performance.now();
      setStatus("running");
      const done = new Promise<Aggregates>((resolve, reject) => {
        w.onmessage = (e: MessageEvent<{ ok: boolean; result?: Aggregates; error?: string }>) => {
          if (e.data.ok && e.data.result) resolve(e.data.result);
          else reject(new Error(e.data.error || "worker error"));
        };
      });
      w.postMessage({
        teams,
        schedule,
        pairwise: pairwiseRef.current,
        iterations,
        seed,
        constraints,
        rho: meta?.dixon_coles_rho ?? -0.05,
      });
      const r = await done;
      setResult(r);
      setElapsedMs(performance.now() - t0);
      setStatus("done");
    } catch (e) {
      setError(String((e as Error)?.message || e));
      setStatus("error");
    }
  }, []);

  return { status, result, error, elapsedMs, run };
}
