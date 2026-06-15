import type { PairwiseEntry, SquadAvailability } from "../types";

export const EMPTY_AVAILABILITY: SquadAvailability = {
  goalkeeper: 0,
  defenders: 0,
  midfielders: 0,
  attackers: 0,
  suspensions: 0,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedAvailability(value?: Partial<SquadAvailability>): SquadAvailability {
  return {
    goalkeeper: clamp(value?.goalkeeper ?? 0, 0, 1),
    defenders: clamp(value?.defenders ?? 0, 0, 3),
    midfielders: clamp(value?.midfielders ?? 0, 0, 3),
    attackers: clamp(value?.attackers ?? 0, 0, 3),
    suspensions: clamp(value?.suspensions ?? 0, 0, 4),
  };
}

/**
 * Apply transparent, conservative availability penalties to expected goals.
 *
 * The coefficients are scenario sensitivities, not trained injury effects:
 * historical timestamped injury coverage is not available. They deliberately
 * stay modest and are exposed in the UI as stress tests.
 */
export function applyAvailabilityScenario(
  pair: PairwiseEntry,
  homeAvailability?: Partial<SquadAvailability>,
  awayAvailability?: Partial<SquadAvailability>,
): PairwiseEntry {
  const home = normalizedAvailability(homeAvailability);
  const away = normalizedAvailability(awayAvailability);

  const homeAttackLoss =
    0.11 * home.attackers +
    0.065 * home.midfielders +
    0.02 * home.suspensions;
  const awayAttackLoss =
    0.11 * away.attackers +
    0.065 * away.midfielders +
    0.02 * away.suspensions;

  const homeDefenceLoss =
    0.16 * home.goalkeeper +
    0.075 * home.defenders +
    0.035 * home.midfielders +
    0.02 * home.suspensions;
  const awayDefenceLoss =
    0.16 * away.goalkeeper +
    0.075 * away.defenders +
    0.035 * away.midfielders +
    0.02 * away.suspensions;

  return {
    ...pair,
    lh: clamp(pair.lh * Math.exp(-homeAttackLoss + awayDefenceLoss), 0.15, 5),
    la: clamp(pair.la * Math.exp(-awayAttackLoss + homeDefenceLoss), 0.15, 5),
  };
}

export function availabilityCount(value?: Partial<SquadAvailability>) {
  const normalized = normalizedAvailability(value);
  return (
    normalized.goalkeeper +
    normalized.defenders +
    normalized.midfielders +
    normalized.attackers +
    normalized.suspensions
  );
}
