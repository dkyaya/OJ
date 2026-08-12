export type ForecastWindow = {
  closed: boolean;
  cutoff?: Date;
  reason: 'open' | 'passed' | 'unscheduled';
};

export function forecastWindow(eventAt?: string, now = Date.now()): ForecastWindow {
  if (!eventAt) return { closed: true, reason: 'unscheduled' };
  const cutoffTime = Date.parse(eventAt);
  if (!Number.isFinite(cutoffTime)) return { closed: true, reason: 'unscheduled' };
  const cutoff = new Date(cutoffTime);
  return now >= cutoffTime ? { closed: true, cutoff, reason: 'passed' } : { closed: false, cutoff, reason: 'open' };
}
