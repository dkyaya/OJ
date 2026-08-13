import type { RemovedResearchSnapshot, ResearchSnapshot, ResearchSnapshotLifecycleEvent } from '../types/domain';

export function partitionResearchSnapshots(snapshots: ResearchSnapshot[], events: ResearchSnapshotLifecycleEvent[]) {
  const latest = new Map<string, ResearchSnapshotLifecycleEvent>();
  for (const event of [...events].sort((a, b) => a.eventOrder - b.eventOrder)) latest.set(event.snapshotId, event);

  const active: ResearchSnapshot[] = [];
  const removed: RemovedResearchSnapshot[] = [];
  for (const snapshot of snapshots) {
    const lifecycle = latest.get(snapshot.id);
    if (lifecycle?.action === 'remove') removed.push({ snapshot, removal: lifecycle });
    else active.push(snapshot);
  }
  return { active, removed };
}
