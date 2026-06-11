"use client";
import { useState } from "react";

export default function CalibrationImage() {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <div className="rounded-md border border-white/5 bg-white/5 p-10 text-center text-sm text-white/40 max-w-md">
        Reliability diagram will appear here after the notebook is run.
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/data/calibration.png"
      alt="Reliability diagram"
      className="rounded-md max-w-full"
      onError={() => setOk(false)}
    />
  );
}
