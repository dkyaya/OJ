import type { Position, Workspace } from '../types/domain';
import { THESIS_HEALTH_LABELS } from './trade-lifecycle';

export function tradeCardFacts(position: Position, workspace: Workspace, today = new Date()) {
  const latestCheckin = [...position.checkins].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
  const catalystIds = new Set([position.originatingCatalystId, ...(position.entryContext?.linkedCatalysts.map((item) => item.catalystId) || [])].filter(Boolean));
  const todayKey = today.toISOString().slice(0, 10);
  const nextCatalyst = workspace.catalysts.filter((item) => catalystIds.has(item.id) && item.date && item.date >= todayKey).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
  const thesisHealth = position.exit?.thesisHealth || latestCheckin?.thesisHealth;
  return {
    thesis: thesisHealth ? THESIS_HEALTH_LABELS[thesisHealth] : 'No Check-In yet',
    catalyst: nextCatalyst ? `${nextCatalyst.event} · ${nextCatalyst.date}` : 'No upcoming linked event',
    expiration: position.expiration || 'TBD',
  };
}

export function journalSummaryPreview(summary: string, limit = 150) {
  const normalized = summary.replace(/\s+/g, ' ').trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1).trimEnd()}…`;
}
