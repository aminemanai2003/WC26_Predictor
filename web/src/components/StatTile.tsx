import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
};

export default function StatTile({ label, value, sub, className }: Props) {
  return (
    <div className={cn("glass p-4 sm:p-5 shadow-card", className)}>
      <div className="text-xs uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-2 text-2xl sm:text-3xl font-semibold numeric tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/50">{sub}</div>}
    </div>
  );
}
