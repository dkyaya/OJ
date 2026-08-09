import { describe, expect, it } from 'vitest';
import { MINIMUM_SPLASH_TIME_MS, remainingSplashTime } from './loading';

describe('remainingSplashTime', () => {
  it('keeps a fast initial load visible long enough to read the animation', () => {
    expect(remainingSplashTime(100, 350)).toBe(MINIMUM_SPLASH_TIME_MS - 250);
  });

  it('does not delay an initial load that already exceeded the minimum', () => {
    expect(remainingSplashTime(100, 2000)).toBe(0);
  });

  it('does not produce a negative wait when the clock moves backward', () => {
    expect(remainingSplashTime(500, 450)).toBe(MINIMUM_SPLASH_TIME_MS);
  });

  it('allows Reduced Motion to skip the artificial minimum', () => {
    expect(remainingSplashTime(100, 100, 0)).toBe(0);
  });
});
