export type RealizedMoveObservation = { signedPercent: number; absolutePercent: number };

export function impliedMovePercent(callMid: number, putMid: number, underlyingPrice: number) {
  if (![callMid, putMid, underlyingPrice].every(Number.isFinite) || callMid < 0 || putMid < 0 || underlyingPrice <= 0) return undefined;
  return ((callMid + putMid) / underlyingPrice) * 100;
}

export function realizedCloseToCloseMove(previousClose: number, eventClose: number): RealizedMoveObservation | undefined {
  if (![previousClose, eventClose].every(Number.isFinite) || previousClose <= 0) return undefined;
  const signedPercent = ((eventClose - previousClose) / previousClose) * 100;
  return { signedPercent, absolutePercent: Math.abs(signedPercent) };
}

export function realizedMoveStats(observations: RealizedMoveObservation[], window: 4 | 8) {
  const sample = observations.slice(0, window);
  if (!sample.length) return undefined;
  const sum = (key: keyof RealizedMoveObservation) => sample.reduce((total, item) => total + item[key], 0) / sample.length;
  return { count: sample.length, averageSignedPercent: sum('signedPercent'), averageAbsolutePercent: sum('absolutePercent') };
}

export const moveMethodLabels = {
  event_implied_move: 'Event-implied move',
  expiration_implied_move: 'Expiration-implied move',
} as const;

