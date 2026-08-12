import type { Workspace } from '../types/domain';

export type IdeaFilter = 'all' | 'draft' | 'watchlist' | 'ready' | 'deferred' | 'rejected' | 'invalidated' | 'archived';

export function deleteConfirmationFor(ticker: string) {
  return `DELETE ${ticker}`;
}

export function canConfirmIdeaDelete(ticker: string, confirmation: string) {
  return confirmation === deleteConfirmationFor(ticker);
}

export function ideasForFilter(workspace: Workspace, filter: IdeaFilter) {
  if (filter === 'archived') return workspace.archivedIdeas;
  if (filter === 'all') return workspace.ideas;
  return workspace.ideas.filter((idea) => idea.status === filter);
}
