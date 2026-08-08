import { TRACKER_POLICY_V1 } from './tracker-policy.v1';

export interface CadenceInput {
  activeDropWindow: boolean;
  postRushActive: boolean;
  minutesUntilExpectedWindow: number | null;
}

export type CadenceReason =
  | 'active_drop_window'
  | 'post_rush'
  | 'within_2_hours'
  | 'within_24_hours'
  | 'within_72_hours'
  | 'normal';

export interface CadenceResult {
  minutes: number;
  reason: CadenceReason;
}

export function calculateCadence(input: CadenceInput): CadenceResult {
  const cadence = TRACKER_POLICY_V1.cadenceMinutes;

  if (input.activeDropWindow) {
    return { minutes: cadence.activeDropWindow, reason: 'active_drop_window' };
  }

  if (input.postRushActive) {
    return { minutes: cadence.postRush, reason: 'post_rush' };
  }

  const minutes = input.minutesUntilExpectedWindow;
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) {
    return { minutes: cadence.normal, reason: 'normal' };
  }

  if (minutes <= 2 * 60) {
    return { minutes: cadence.within2Hours, reason: 'within_2_hours' };
  }

  if (minutes <= 24 * 60) {
    return { minutes: cadence.within24Hours, reason: 'within_24_hours' };
  }

  if (minutes <= 72 * 60) {
    return { minutes: cadence.within72Hours, reason: 'within_72_hours' };
  }

  return { minutes: cadence.normal, reason: 'normal' };
}
