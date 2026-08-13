import type { MarketSnapshot } from '../lib/catalyst-intelligence/types';
import { analyzeOptionChain, optionMidpoint } from '../lib/catalyst-intelligence/option-chain';

type CacheMetadata = { hit: boolean; fetchedAt: string };
const number = (value?: number, digits = 2) => value === undefined ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = (value?: number) => value === undefined ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
const percent = (value?: number) => value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
const dateTime = (value?: string) => value ? new Date(value).toLocaleString() : 'Not recorded';
const date = (value?: string) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Expiration not recorded';

const ContractDetail = ({ contract, label }: { contract?: MarketSnapshot; label: string }) => <div className="option-contract-detail">
  <b>{label}</b>
  {contract ? <dl>
    <div><dt>Symbol</dt><dd>{contract.contractSymbol || '—'}</dd></div><div><dt>Last</dt><dd>{number(contract.last)}</dd></div>
    <div><dt>Volume</dt><dd>{number(contract.volume, 0)}</dd></div><div><dt>Open interest</dt><dd>{number(contract.openInterest, 0)}</dd></div>
    <div><dt>Delta</dt><dd>{number(contract.delta, 3)}</dd></div><div><dt>Gamma</dt><dd>{number(contract.gamma, 3)}</dd></div>
    <div><dt>Theta</dt><dd>{number(contract.theta, 3)}</dd></div><div><dt>Vega</dt><dd>{number(contract.vega, 3)}</dd></div>
  </dl> : <span>No contract at this strike.</span>}
</div>;

export function OptionChainSnapshot({ contracts, cache, technicalValues }: { contracts: MarketSnapshot[]; cache?: CacheMetadata; technicalValues?: Record<string, unknown> }) {
  const chain = analyzeOptionChain(contracts);
  if (!chain) return <p className="muted-copy">No usable option contracts were found in this snapshot.</p>;
  return <section className="option-chain" aria-label={`${chain.ticker} option chain`}>
    <header className="option-chain-header">
      <div><span className="eyebrow">Paired option chain</span><h4>{chain.ticker} · {date(chain.expiration)}</h4><p>{chain.contractCount} contracts · underlying {money(chain.underlyingPrice)} · {chain.provider}</p></div>
      <span className={`freshness-badge ${chain.freshness}`}>{chain.freshness}</span>
    </header>
    <dl className="option-chain-provenance">
      <div><dt>Observed</dt><dd>{dateTime(chain.observedAt)}</dd></div><div><dt>Fetched</dt><dd>{dateTime(chain.fetchedAt)}</dd></div>
      <div><dt>Source</dt><dd>{chain.sourceReference || 'Stored private observation'}</dd></div><div><dt>Cache</dt><dd>{cache ? `${cache.hit ? 'Private cache hit' : 'New provider response cached'} · ${dateTime(cache.fetchedAt)}` : 'Not recorded with saved snapshot'}</dd></div>
    </dl>
    {chain.atmSummary && <div className="atm-summary"><span>Nearest ATM · {number(chain.atmStrike)}</span><b>{money(chain.atmSummary.callMidpoint)} call + {money(chain.atmSummary.putMidpoint)} put = ±{money(chain.atmSummary.dollarMove)} / {number(chain.atmSummary.percentMove)}%</b><small>Midpoints use bid/ask when both are valid. Exact strike-distance ties use the lower strike.</small></div>}
    <div className="option-chain-scroll" tabIndex={0} aria-label="Horizontally scrollable paired option-chain table">
      <table>
        <thead><tr><th>Call Bid</th><th>Ask</th><th>Mid</th><th>IV</th><th className="strike-column">Strike</th><th>Put IV</th><th>Mid</th><th>Bid</th><th>Ask</th></tr></thead>
        <tbody>{chain.rows.map((row) => <tr key={row.strike} className={row.atm ? 'atm-row' : undefined}>
          <td>{number(row.call?.bid)}</td><td>{number(row.call?.ask)}</td><td>{number(optionMidpoint(row.call))}</td><td>{percent(row.call?.impliedVolatility)}</td>
          <th scope="row" className="strike-column">{number(row.strike)}{row.atm && <small>ATM</small>}</th>
          <td>{percent(row.put?.impliedVolatility)}</td><td>{number(optionMidpoint(row.put))}</td><td>{number(row.put?.bid)}</td><td>{number(row.put?.ask)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <details className="chain-details"><summary>Contract Details</summary><div>{chain.rows.map((row) => <section key={row.strike}><h5>{number(row.strike)} strike{row.atm ? ' · nearest ATM' : ''}</h5><ContractDetail contract={row.call} label="Call" /><ContractDetail contract={row.put} label="Put" /></section>)}</div></details>
    {technicalValues && <details className="technical-details"><summary>Technical Details</summary><pre>{JSON.stringify(technicalValues, null, 2)}</pre></details>}
  </section>;
}
