import { describe, expect, it } from 'vitest';
import { calculateCadence } from '../../src/domain/cadence';

const baseInput = {
  activeDropWindow: false,
  postRushActive: false,
};

describe('calculateCadence', () => {
  it.each([
    [4321, 60, 'normal'],
    [4320, 30, 'within_72_hours'],
    [1441, 30, 'within_72_hours'],
    [1440, 15, 'within_24_hours'],
    [121, 15, 'within_24_hours'],
    [120, 10, 'within_2_hours'],
    [0, 10, 'within_2_hours'],
  ] as const)('maps %i minutes to %i minutes', (minutesUntilExpectedWindow, minutes, reason) => {
    expect(calculateCadence({ ...baseInput, minutesUntilExpectedWindow })).toEqual({
      minutes,
      reason,
    });
  });

  it('uses a deterministic five-minute active-window target', () => {
    const input = {
      activeDropWindow: true,
      postRushActive: false,
      minutesUntilExpectedWindow: 5000,
    };

    expect(calculateCadence(input)).toEqual({
      minutes: 5,
      reason: 'active_drop_window',
    });
    expect(calculateCadence(input)).toEqual(calculateCadence(input));
  });

  it('uses 30 minutes during post-rush', () => {
    expect(calculateCadence({
      activeDropWindow: false,
      postRushActive: true,
      minutesUntilExpectedWindow: -30,
    })).toEqual({ minutes: 30, reason: 'post_rush' });
  });

  it.each([null, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns the normal cadence for an unusable window value %s',
    (minutesUntilExpectedWindow) => {
      expect(calculateCadence({ ...baseInput, minutesUntilExpectedWindow })).toEqual({
        minutes: 60,
        reason: 'normal',
      });
    }
  );
});
