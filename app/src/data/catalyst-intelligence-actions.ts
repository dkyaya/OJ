import type { CatalystIntelligenceActions } from '../components/CatalystIntelligence';
import { saveResearchSnapshot } from './actions';
import { loadDelayedOptions, loadProviderStatus } from './catalyst-intelligence';

// This is the production boundary. Shared Catalyst Intelligence UI receives these
// actions by injection; the Tutorial supplies a fixture-only implementation.
export const productionCatalystIntelligenceActions: CatalystIntelligenceActions = {
  saveSnapshot: saveResearchSnapshot,
  loadProviderStatus,
  loadDelayedOptions,
};
