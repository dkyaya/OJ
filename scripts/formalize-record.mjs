import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const payload = Array.isArray(raw) ? raw[0]?.payload : raw.payload;
if (!payload || typeof payload !== 'object') throw new Error('Missing immutable formalization payload');

const recordType = String(payload._formalization?.record_type || 'trade_idea');
const supported = new Set(['trade_idea', 'trade_entry', 'trade_checkin', 'trade_exit', 'journal_review', 'catalyst', 'research_annotation']);
if (!supported.has(recordType)) throw new Error(`Unsupported formalization record type: ${recordType}`);
if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(payload.id || ''))) throw new Error('Invalid record UUID');
if (!Number.isInteger(Number(payload.revision)) || Number(payload.revision) < 1) throw new Error('Invalid record revision');
if (payload.data !== undefined && (typeof payload.data !== 'object' || Array.isArray(payload.data))) throw new Error('Record data must be an object');

const serialized = JSON.stringify(payload);
const forbidden = /ghp_|github_pat_|sb_secret_|service[_ -]?role|password\s*[:=]|routing number|account number|brokerage credential/i;
if (forbidden.test(serialized)) throw new Error('Payload contains a private or credential-like marker; formalization stopped');

const clean = (value) =>
  String(value || 'TBD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
const yaml = (value) => JSON.stringify(String(value ?? 'TBD').replace(/\r?\n/g, ' '));
const line = (value) => String(value ?? 'TBD').replace(/\r?\n/g, ' ').trim() || 'TBD';
const dollars = (value) => (Number.isFinite(value) ? `$${value.toFixed(2)}` : 'TBD');
const safeExistingPath = (value) => {
  const candidate = String(value || '');
  return /^(Trade Ideas|Research|Journal)\/[a-zA-Z0-9_./ -]+\.md$/.test(candidate) && !candidate.includes('..')
    ? candidate
    : null;
};
const data = payload.data || {};
const parent = payload._formalization?.parent || {};
const candidateTicker = String(payload.ticker || parent.ticker || data.Ticker || 'UNKNOWN')
  .toUpperCase()
  .replace(/[^A-Z0-9.-]/g, '');
const ticker = candidateTicker || 'UNKNOWN';
const revision = Number(payload.revision);
const id = String(payload.id);
const jobId = String(process.env.OJ_JOB_ID || 'TBD');
const branch = `formalize/${clean(recordType)}/${clean(ticker)}-${clean(id).slice(0, 8)}-r${revision}`;

const defaultPath = () => {
  if (recordType === 'trade_idea') return `Trade Ideas/${new Date().toISOString().slice(0, 7)}-${ticker}-${clean(payload.strategy) || 'strategy'}.md`;
  if (recordType === 'catalyst') return `Research/Catalysts/${String(payload.event_at || new Date().toISOString()).slice(0, 10)}-${clean(payload.event).slice(0, 50)}-${clean(id).slice(0, 8)}.md`;
  if (recordType === 'research_annotation') return `Research/${new Date().toISOString().slice(0, 7)}-${ticker}-${clean(id).slice(0, 8)}.md`;
  return `Journal/${new Date().toISOString().slice(0, 10)}-${ticker}-${clean(recordType)}-${clean(id).slice(0, 8)}.md`;
};
const notePath = safeExistingPath(payload.published_note_path) || safeExistingPath(parent.published_note_path) || defaultPath();
const payloadHash = crypto.createHash('sha256').update(serialized).digest('hex');

const candidateMarkdown = (candidate) => {
  const numeric = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const longStrike = Number(candidate.long_strike);
  const shortStrike = Number(candidate.short_strike);
  const debit = Number(candidate.net_debit);
  const contracts = Math.max(1, Number(candidate.contracts) || 1);
  const complete = [candidate.long_strike, candidate.short_strike, candidate.net_debit].every(numeric);
  const width = complete ? Math.abs(shortStrike - longStrike) : Number.NaN;
  const maxLoss = complete ? debit * 100 * contracts : Number.NaN;
  const maxProfit = complete ? (width - debit) * 100 * contracts : Number.NaN;
  const breakEven = complete
    ? payload.strategy === 'bear-put-spread'
      ? longStrike - debit
      : longStrike + debit
    : Number.NaN;
  const rewardRisk = maxLoss > 0 ? maxProfit / maxLoss : Number.NaN;
  return `### ${line(candidate.name)}

- Expiration: ${line(candidate.expiration)}
- Contracts: ${contracts}
- Long strike: ${complete ? dollars(longStrike) : line(candidate.long_strike)}
- Short strike: ${complete ? dollars(shortStrike) : line(candidate.short_strike)}
- Net debit: ${complete ? dollars(debit) : line(candidate.net_debit)}
- Maximum loss: ${complete ? dollars(maxLoss) : line(candidate.maximum_loss)}
- Maximum profit: ${complete ? dollars(maxProfit) : line(candidate.maximum_profit)}
- Break-even: ${complete ? dollars(breakEven) : line(candidate.break_even)}
- Reward/risk: ${Number.isFinite(rewardRisk) ? `${rewardRisk.toFixed(2)}×` : 'TBD'}
- Calculation state: ${complete ? 'Calculated deterministically from submitted strikes/debit' : 'TBD — missing numeric inputs'}
`;
};

const renderTradeIdea = () => {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  return `---
id: ${yaml(id)}
ticker: ${yaml(ticker)}
strategy: ${yaml(payload.strategy)}
status: ${yaml(data.status || 'watchlist')}
bias: ${yaml(payload.bias)}
confidence: ${yaml(payload.confidence)}
source_revision: ${revision}
formalization_job_id: ${yaml(jobId)}
submitted_at: ${yaml(payload.last_submitted_at || new Date().toISOString())}
---

# ${ticker} ${line(payload.strategy)}

> Formalized from user-owned cloud draft revision ${revision}. Missing values remain TBD. No order or fill is implied.

## Thesis

${line(data['Thesis summary'] || data.thesis)}

## Candidate structures

${
  candidates.length
    ? candidates.map(candidateMarkdown).join('\n')
    : `- Balanced: ${line(data['Balanced candidate'])}
- Aggressive: ${line(data['Aggressive candidate'])}`
}

## Entry conditions

${line(data['Entry conditions'])}

## Invalidation and exit

${line(data['Invalidation conditions'])}

## Planned exit

${line(data['Planned exit'])}

## Audit trail

- Cloud record: ${id}
- Revision: ${revision}
- Payload hash: ${payloadHash}
- Formalization job: ${jobId}
`;
};

const publicFields = ['summary', 'decision', 'rationale', 'price', 'contracts', 'debit', 'credit', 'maximum_loss', 'maximum_profit', 'break_even', 'outcome', 'lesson', 'next_action'];
const detailList = () => {
  const rows = publicFields.filter((key) => data[key] !== undefined).map((key) => `- ${key.replaceAll('_', ' ')}: ${line(data[key])}`);
  return rows.length ? rows.join('\n') : '- Details: TBD';
};
const sectionTitle = {
  trade_entry: 'Entry',
  trade_checkin: 'Check-in',
  trade_exit: 'Exit',
  journal_review: 'Journal review',
  catalyst: 'Catalyst',
  research_annotation: 'Research annotation',
}[recordType];
const renderRelated = () => `## ${sectionTitle} — ${new Date(payload.created_at || Date.now()).toISOString().slice(0, 10)}

${recordType === 'catalyst' ? `- Event: ${line(payload.event)}\n- Type: ${line(payload.event_type)}\n- Scheduled: ${line(payload.event_at)}` : ''}
${recordType === 'research_annotation' ? `- Classification: ${line(payload.classification)}\n- Summary: ${line(payload.summary)}` : ''}
${recordType === 'trade_entry' || recordType === 'trade_exit' ? `- Actual confirmation: ${payload.confirmed_actual ? 'User confirmed' : 'Unconfirmed — not an actual fill'}` : ''}
${recordType === 'journal_review' ? `- Ratings: ${line(JSON.stringify(payload.ratings || {}))}` : ''}
${detailList()}

### Audit

- Cloud record: ${id}
- Revision: ${revision}
- Payload hash: ${payloadHash}
- Formalization job: ${jobId}
`;

const markdown = recordType === 'trade_idea' ? renderTradeIdea() : renderRelated();
const output = process.env.GITHUB_OUTPUT;
if (output) {
  fs.appendFileSync(output, `branch=${branch}\nnote_path=${notePath}\nticker=${ticker}\nrevision=${revision}\nrecord_type=${recordType}\n`);
}

if (process.env.OJ_DRY_RUN === '1') {
  console.log(`Prepared metadata for ${recordType} ${ticker} revision ${revision}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(notePath), { recursive: true });
if (!fs.existsSync(notePath)) {
  fs.writeFileSync(
    notePath,
    recordType === 'trade_idea'
      ? markdown
      : `---\nrecord_type: ${yaml(recordType)}\nticker: ${yaml(ticker)}\n---\n\n# ${ticker} journal record\n\n${markdown}`,
  );
} else {
  const old = fs.readFileSync(notePath, 'utf8');
  const alreadyApplied = old.includes(`Formalization job: ${jobId}`) || old.includes(`formalization_job_id: ${yaml(jobId)}`);
  if (!alreadyApplied && recordType === 'trade_idea') {
    const oldBody = old.replace(/^---[\s\S]*?---\s*/, '').trim();
    fs.writeFileSync(notePath, `${markdown}\n\n## Revision history\n\n### Before revision ${revision}\n\n${oldBody}\n`);
  } else if (!alreadyApplied) {
    fs.writeFileSync(notePath, `${old.trim()}\n\n${markdown}`);
  }
}

console.log(`Formalized ${recordType} ${ticker} revision ${revision} to ${notePath}`);
