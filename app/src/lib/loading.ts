export const MINIMUM_SPLASH_TIME_MS = 1050;

export function remainingSplashTime(startedAt: number, now: number, minimum = MINIMUM_SPLASH_TIME_MS) {
  if (![startedAt, now, minimum].every(Number.isFinite) || minimum <= 0) return 0;
  return Math.max(0, minimum - Math.max(0, now - startedAt));
}
