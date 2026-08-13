import { supabase } from '../lib/supabase';
import type { MarketSnapshot, ProviderStatus } from '../lib/catalyst-intelligence/types';
import { validateOptionsChainRequest, type OptionsChainRequest } from '../lib/catalyst-intelligence/providers';

type GatewayEnvelope<T> = { result?: T; providers?: ProviderStatus[]; zeroRecurringCost?: boolean; polling?: boolean; cache?: { hit: boolean; fetchedAt: string }; error?: string };
export type GatewayTransport = <T>(action: string, payload: Record<string, unknown>) => Promise<{ data: GatewayEnvelope<T> | null; error: { message: string } | null }>;

const defaultTransport: GatewayTransport = async <T,>(action: string, payload: Record<string, unknown>) => {
  if (!supabase) return { data: null, error: { message: 'cloud_not_configured' } };
  const { data, error } = await supabase.functions.invoke('catalyst-intelligence-data', { body: { action, payload } });
  return { data: data as GatewayEnvelope<T> | null, error: error ? { message: error.message } : null };
};

const gatewayError = (code: string) => ({
  provider_configuration_needed: 'This provider needs server-side configuration. Manual entry remains available.',
  provider_quota_exhausted: 'The provider quota is unavailable right now. No retry was started; use manual entry or return later.',
  provider_quota_guard: 'OJ reached its conservative free-tier request budget. No provider call was made; use manual entry or return later.',
  provider_unavailable: 'The provider is temporarily unavailable. Manual entry remains available.',
  provider_timeout: 'The provider timed out. No automatic retry was started.',
  narrow_options_request_required: 'Choose one ticker, one exact expiration, and no more than 10 nearby strikes.',
  cache_unavailable: 'The private provider cache is not available yet. Try again after the Supabase migration completes.',
  cache_write_failed: 'OJ did not save the provider response, so it was not returned. No Research Ledger record was changed.',
  approved_account_required: 'An active approved OJ account is required.',
}[code] || 'Provider data could not be loaded. Manual entry remains available.');

export async function callIntelligenceGateway<T>(action: string, payload: Record<string, unknown> = {}, transport: GatewayTransport = defaultTransport) {
  const response = await transport<T>(action, payload);
  const code = response.data?.error || response.error?.message;
  if (code) throw new Error(gatewayError(code));
  return response.data;
}

export async function loadProviderStatus(transport?: GatewayTransport) {
  const response = await callIntelligenceGateway<never>('status', {}, transport);
  return response?.providers || [];
}

export async function loadDelayedOptions(input: OptionsChainRequest, transport?: GatewayTransport) {
  const request = validateOptionsChainRequest(input);
  const response = await callIntelligenceGateway<{ data: MarketSnapshot[] }>('options_chain', request as unknown as Record<string, unknown>, transport);
  return { snapshots: response?.result?.data || [], cache: response?.cache };
}
