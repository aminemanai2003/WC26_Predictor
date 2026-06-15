export type Team = {
  code: string;
  name: string;
  iso2: string;
  confederation: string;
  host: boolean;
  group: string;
  elo: number;
};

export type Match = {
  id: string;
  stage: "group" | "R32" | "R16" | "QF" | "SF" | "3RD" | "F";
  group?: string;
  round?: number;
  date: string;
  home: string | null;
  away: string | null;
  neutral: boolean;
  completed?: boolean;
  homeScore?: number;
  awayScore?: number;
};

export type PairwiseEntry = {
  lh: number; // lambda home
  la: number; // lambda away
  pH: number;
  pD: number;
  pA: number;
};

export type Pairwise = Record<string, PairwiseEntry>;

export type Meta = {
  version: string;
  trained_at: string;
  dixon_coles_rho: number;
  ensemble_w_clf: number;
  classifier?: string;
  recency_half_life_years?: number;
  features: string[];
  test_metrics: Record<string, { log_loss: number; rps: number; name?: string }>;
  train_window: string;
  val_window: string;
  test_window: string;
  production_train_window?: string;
  latest_result_date?: string;
  completed_world_cup_matches?: number;
  n_matches_used: number;
};

export type SimConstraints = {
  // Force a match outcome: { "G001": "H" | "D" | "A" } or specific scoreline
  matchResult?: Record<string, "H" | "D" | "A">;
  matchScore?: Record<string, [number, number]>;
};

export type TournamentResult = {
  // Per-team probabilities
  groupTop1: Record<string, number>;
  groupTop2: Record<string, number>;
  qualifyR32: Record<string, number>;
  reachR16: Record<string, number>;
  reachQF: Record<string, number>;
  reachSF: Record<string, number>;
  reachFinal: Record<string, number>;
  champion: Record<string, number>;
  // Expected group standings
  expectedPoints: Record<string, number>;
  // Number of iterations actually run
  iterations: number;
  seed: number;
};
