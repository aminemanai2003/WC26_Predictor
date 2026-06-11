import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

type Props = {
  team: Team | undefined;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
};

const sizes = {
  sm: { flag: "w-5", text: "text-xs", gap: "gap-1.5" },
  md: { flag: "w-7", text: "text-sm", gap: "gap-2" },
  lg: { flag: "w-10", text: "text-base", gap: "gap-2.5" },
};

export default function TeamBadge({ team, size = "md", showName = true, className }: Props) {
  if (!team)
    return (
      <span className={cn("inline-flex items-center gap-2 text-white/40 italic", className)}>
        TBD
      </span>
    );
  const s = sizes[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <span
        aria-hidden
        className={cn("fi", `fi-${team.iso2}`, "rounded-sm overflow-hidden shadow-sm", s.flag)}
        style={{ display: "inline-block", aspectRatio: "4/3" }}
      />
      {showName && <span className={cn("font-medium tracking-tight", s.text)}>{team.name}</span>}
    </span>
  );
}
