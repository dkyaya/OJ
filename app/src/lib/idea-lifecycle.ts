import type { Workspace } from '../types/domain';

export type IdeaFilter = 'all' | 'watchlist' | 'ready' | 'deferred' | 'archived';

export function ideasForFilter(workspace: Workspace, filter: IdeaFilter) {
  if (filter === 'archived') return workspace.archivedIdeas;
  if (filter === 'all') return workspace.ideas;
  return workspace.ideas.filter((idea) => idea.status === filter);
}
