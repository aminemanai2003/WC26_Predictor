"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  value: number; // 0..1
  label?: string;
  color?: string;
  className?: string;
  showValue?: boolean;
};

export default function ProbabilityBar({ value, label, color = "#10e07d", className, showValue = true }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between text-xs mb-1">
          {label && <span className="text-white/60">{label}</span>}
          {showValue && (
            <span className="numeric font-medium text-white/90">{(pct * 100).toFixed(1)}%</span>
          )}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: color }}
          className="h-full rounded-full"
        />
      </div>
    </div>
  );
}
