/// <reference lib="webworker" />
import { simulate, type SimInput } from "./engine";

self.onmessage = (e: MessageEvent<SimInput>) => {
  try {
    const result = simulate(e.data);
    (self as unknown as Worker).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String((err as Error)?.message || err) });
  }
};

export {};
