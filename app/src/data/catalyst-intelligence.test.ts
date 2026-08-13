import { describe, expect, it, vi } from 'vitest';
import { callIntelligenceGateway, loadDelayedOptions, loadProviderStatus, type GatewayTransport } from './catalyst-intelligence';

const transport = (data: unknown = null, error: { message: string } | null = null) => vi.fn(async () => ({ data, error })) as unknown as GatewayTransport;

describe('Catalyst Intelligence gateway client', () => {
  it('loads provider status without requiring configured providers', async () => {
    const status = [{ id: 'manual', availability: 'manual_only' }];
    await expect(loadProviderStatus(transport({ providers: status }))).resolves.toEqual(status);
  });

  it.each([
    ['provider_configuration_needed', 'server-side configuration'],
    ['provider_quota_exhausted', 'No retry was started'],
    ['provider_quota_guard', 'No provider call was made'],
    ['provider_unavailable', 'temporarily unavailable'],
    ['provider_timeout', 'No automatic retry'],
  ])('maps %s without leaking provider responses', async (code, copy) => {
    await expect(callIntelligenceGateway('test', {}, transport({ error: code }))).rejects.toThrow(copy);
  });

  it('handles malformed/5xx transport errors with a safe fallback', async () => {
    await expect(callIntelligenceGateway('test', {}, transport(null, { message: 'unexpected private 5xx body' }))).rejects.toThrow('Provider data could not be loaded');
  });

  it('returns cache metadata and never schedules polling', async () => {
    const mocked = transport({ result: { data: [{ ticker: 'SPY' }] }, cache: { hit: true, fetchedAt: '2026-08-12T20:00:00Z' } });
    const response = await loadDelayedOptions({ ticker: 'SPY', expiration: '2026-08-21', strikeLimit: 6 }, mocked);
    expect(response).toMatchObject({ snapshots: [{ ticker: 'SPY' }], cache: { hit: true } });
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('reports a cache miss without silently saving a Research Ledger record', async () => {
    const mocked = transport({ result: { data: [] }, cache: { hit: false, fetchedAt: '2026-08-12T20:00:00Z' } });
    await expect(loadDelayedOptions({ ticker: 'SPY', expiration: '2026-08-21', strikeLimit: 2 }, mocked)).resolves.toMatchObject({ snapshots: [], cache: { hit: false } });
    expect(mocked).toHaveBeenCalledTimes(1);
  });
});
