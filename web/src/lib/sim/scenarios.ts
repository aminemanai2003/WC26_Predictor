import type {
  ContextStress,
  PairwiseEntry,
  SquadAvailability,
  TacticalStress,
} from "../types";

export const EMPTY_AVAILABILITY: SquadAvailability = {
  goalkeeper: 0,
  defenders: 0,
  midfielders: 0,
  attackers: 0,
  suspensions: 0,
};

export const EMPTY_TACTICAL_STRESS: TacticalStress = {
  midfieldVoid: 0,
  defensiveDisorganization: 0,
  attackingDisconnect: 0,
  pressingFailure: 0,
};

export const EMPTY_CONTEXT_STRESS: ContextStress = {
  fatigue: 0,
  heat: 0,
  travel: 0,
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

function normalizedTacticalStress(value?: Partial<TacticalStress>): TacticalStress {
  return {
    midfieldVoid: clamp(value?.midfieldVoid ?? 0, 0, 2),
    defensiveDisorganization: clamp(value?.defensiveDisorganization ?? 0, 0, 2),
    attackingDisconnect: clamp(value?.attackingDisconnect ?? 0, 0, 2),
    pressingFailure: clamp(value?.pressingFailure ?? 0, 0, 2),
  };
}

function normalizedContextStress(value?: Partial<ContextStress>): ContextStress {
  return {
    fatigue: clamp(value?.fatigue ?? 0, 0, 2),
    heat: clamp(value?.heat ?? 0, 0, 2),
    travel: clamp(value?.travel ?? 0, 0, 2),
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

export function applyDynamicScenario(
  pair: PairwiseEntry,
  homeAvailability?: Partial<SquadAvailability>,
  awayAvailability?: Partial<SquadAvailability>,
  homeTacticalStress?: Partial<TacticalStress>,
  awayTacticalStress?: Partial<TacticalStress>,
  homeContextStress?: Partial<ContextStress>,
  awayContextStress?: Partial<ContextStress>,
): PairwiseEntry {
  const availabilityAdjusted = applyAvailabilityScenario(
    pair,
    homeAvailability,
    awayAvailability,
  );
  const home = normalizedTacticalStress(homeTacticalStress);
  const away = normalizedTacticalStress(awayTacticalStress);
  const homeContext = normalizedContextStress(homeContextStress);
  const awayContext = normalizedContextStress(awayContextStress);

  const homeAttackLoss =
    0.075 * home.midfieldVoid +
    0.085 * home.attackingDisconnect +
    0.025 * home.pressingFailure +
    0.045 * homeContext.fatigue +
    0.025 * homeContext.heat +
    0.025 * homeContext.travel;
  const awayAttackLoss =
    0.075 * away.midfieldVoid +
    0.085 * away.attackingDisconnect +
    0.025 * away.pressingFailure +
    0.045 * awayContext.fatigue +
    0.025 * awayContext.heat +
    0.025 * awayContext.travel;
  const homeDefenceLoss =
    0.07 * home.midfieldVoid +
    0.09 * home.defensiveDisorganization +
    0.055 * home.pressingFailure +
    0.055 * homeContext.fatigue +
    0.035 * homeContext.heat +
    0.02 * homeContext.travel;
  const awayDefenceLoss =
    0.07 * away.midfieldVoid +
    0.09 * away.defensiveDisorganization +
    0.055 * away.pressingFailure +
    0.055 * awayContext.fatigue +
    0.035 * awayContext.heat +
    0.02 * awayContext.travel;

  return {
    ...availabilityAdjusted,
    lh: clamp(
      availabilityAdjusted.lh * Math.exp(-homeAttackLoss + awayDefenceLoss),
      0.15,
      5,
    ),
    la: clamp(
      availabilityAdjusted.la * Math.exp(-awayAttackLoss + homeDefenceLoss),
      0.15,
      5,
    ),
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

export function tacticalStressCount(value?: Partial<TacticalStress>) {
  const normalized = normalizedTacticalStress(value);
  return Object.values(normalized).reduce((sum, item) => sum + item, 0);
}

export function contextStressCount(value?: Partial<ContextStress>) {
  const normalized = normalizedContextStress(value);
  return Object.values(normalized).reduce((sum, item) => sum + item, 0);
}

export function tacticalVoidIndex(
  availability?: Partial<SquadAvailability>,
  tacticalStress?: Partial<TacticalStress>,
) {
  const squad = normalizedAvailability(availability);
  const tactical = normalizedTacticalStress(tacticalStress);
  const raw =
    14 * squad.goalkeeper +
    5 * squad.defenders +
    8 * squad.midfielders +
    6 * squad.attackers +
    3 * squad.suspensions +
    18 * tactical.midfieldVoid +
    12 * tactical.defensiveDisorganization +
    11 * tactical.attackingDisconnect +
    9 * tactical.pressingFailure;
  return Math.round(clamp(raw, 0, 100));
}
