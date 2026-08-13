import type { Catalyst, IdeaStatus, TradeIdea } from '../../types/domain';

export const IDEA_STATUSES = ['Draft', 'Watchlist', 'Ready', 'Deferred', 'Rejected', 'Invalidated'] as const;
export const ASSET_TYPES = ['ETF', 'Equity', 'Index', 'Other'] as const;
export const STRATEGIES = ['Bear Put Spread', 'Bull Call Spread'] as const;
export const BIASES = ['Bearish', 'Bullish', 'Neutral'] as const;
export const CONFIDENCE_LEVELS = ['Low', 'Moderate', 'High'] as const;

export const CATALYST_CATEGORIES = [
  'Employment', 'Inflation', 'Growth / Activity', 'Central Bank', 'Earnings',
  'Company / Corporate', 'Rates / Treasury', 'Fiscal Policy', 'Trade / Tariffs',
  'Regulation / Legal', 'Geopolitical', 'Commodity / Energy',
  'Technical / Market Structure', 'Other',
] as const;

export type CanonicalField = {
  name: string;
  label: string;
  placeholder?: string;
  options?: readonly string[];
  required?: boolean;
  multiline?: boolean;
  inputType?: 'text' | 'date' | 'url' | 'number';
  showWhen?: (data: Record<string, string>) => boolean;
};

export const IDEA_SECTIONS: ReadonlyArray<{ title: 'Setup' | 'Catalyst' | 'Research' | 'Candidate'; subtitle: string; fields: CanonicalField[] }> = [
  { title: 'Setup', subtitle: 'Define the security and the state of the research.', fields: [
    { name: 'Ticker', label: 'Ticker', placeholder: 'SPY', required: true },
    { name: 'Asset Type', label: 'Asset Type', options: ASSET_TYPES, required: true },
    { name: 'Strategy', label: 'Strategy', options: STRATEGIES, required: true },
    { name: 'Bias', label: 'Bias', options: BIASES, required: true },
    { name: 'Status', label: 'Status', options: IDEA_STATUSES, required: true },
  ] },
  { title: 'Catalyst', subtitle: 'Link a scheduled event or create a verified one.', fields: [
    { name: 'Catalyst setup', label: 'Catalyst', options: ['Use Existing', 'Create New', 'None'], required: true },
    { name: 'Existing catalyst ID', label: 'Scheduled Catalyst', showWhen: (data) => data['Catalyst setup'] === 'Use Existing' },
    { name: 'Catalyst title', label: 'Event Name', placeholder: 'Scheduled release', required: true, showWhen: (data) => data['Catalyst setup'] === 'Create New' },
    { name: 'Verification source', label: 'Source', placeholder: 'Official publisher', showWhen: (data) => data['Catalyst setup'] === 'Create New' },
    { name: 'Source URL', label: 'Link', placeholder: 'https://…', inputType: 'url', showWhen: (data) => data['Catalyst setup'] === 'Create New' },
    { name: 'Catalyst date', label: 'Date', inputType: 'date', required: true, showWhen: (data) => data['Catalyst setup'] === 'Create New' },
    { name: 'Catalyst category', label: 'Category', options: CATALYST_CATEGORIES, required: true, showWhen: (data) => data['Catalyst setup'] === 'Create New' },
  ] },
  { title: 'Research', subtitle: 'Record the private decision evidence and boundaries.', fields: [
    { name: 'Thesis', label: 'Thesis', multiline: true, required: true },
    { name: 'Evidence', label: 'Evidence', multiline: true },
    { name: 'Entry conditions', label: 'Entry Conditions', multiline: true },
    { name: 'Planned exit', label: 'Planned Exit', multiline: true },
    { name: 'Invalidation', label: 'Invalidation', multiline: true },
    { name: 'Hold through events', label: 'Hold Through', multiline: true },
    { name: 'Avoid events', label: 'Avoid', multiline: true },
  ] },
  { title: 'Candidate', subtitle: 'Describe one defined-risk candidate without placing an order.', fields: [
    { name: 'Expiration', label: 'Expiration', inputType: 'date', placeholder: 'Optional' },
    { name: 'Long strike', label: 'Long Strike', inputType: 'number', placeholder: 'Optional' },
    { name: 'Short strike', label: 'Short Strike', inputType: 'number', placeholder: 'Optional' },
    { name: 'Net debit', label: 'Net Debit', inputType: 'number', placeholder: 'Optional' },
    { name: 'Contracts', label: 'Number of Contracts', inputType: 'number', placeholder: '1' },
    { name: 'Confidence', label: 'Confidence', options: CONFIDENCE_LEVELS },
  ] },
];

const title = (value: string) => value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : '';
const joined = (value?: string[]) => value?.join('\n') || '';
const value = (data: Record<string, unknown>, key: string) => typeof data[key] === 'string' ? String(data[key]) : '';

export function initialIdeaData(mode: 'ticker' | 'catalyst' = 'ticker'): Record<string, string> {
  return {
    'Asset Type': 'ETF', Strategy: 'Bear Put Spread', Bias: 'Bearish', Status: 'Draft',
    'Catalyst setup': mode === 'catalyst' ? 'Create New' : 'None',
    'Catalyst category': 'Other', Contracts: '1', Confidence: 'Moderate',
  };
}

export function ideaToFormData(idea: TradeIdea): Record<string, string> {
  const candidate = idea.candidates[0];
  const preserved = Object.fromEntries(Object.entries(idea.data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  return {
    ...initialIdeaData(), ...preserved,
    Ticker: idea.ticker,
    'Asset Type': idea.assetType || value(idea.data, 'Asset Type') || value(idea.data, 'Underlying type') || 'Other',
    Strategy: idea.strategy.split(' ').map(title).join(' '),
    Bias: title(idea.bias),
    Status: title(idea.status),
    'Catalyst setup': idea.catalystId ? 'Use Existing' : 'None',
    'Existing catalyst ID': idea.catalystId || '',
    Thesis: idea.thesis || '', Evidence: idea.evidence || '',
    'Entry conditions': idea.entryConditions || '', 'Planned exit': idea.plannedExit || '',
    Invalidation: idea.invalidation || '', 'Hold through events': joined(idea.holdThroughEvents),
    'Avoid events': joined(idea.avoidEvents),
    'Candidate ID': candidate?.id || '',
    Expiration: candidate?.expiration || '',
    'Long strike': candidate?.longStrike?.toString() || '',
    'Short strike': candidate?.shortStrike?.toString() || '',
    'Net debit': candidate?.debit?.toString() || '',
    Contracts: candidate?.contracts?.toString() || '1',
    Confidence: idea.confidence ? title(idea.confidence) : 'Moderate',
  };
}

export function catalystToFormData(catalyst?: Catalyst): Partial<Record<string, string>> {
  if (!catalyst) return {};
  return {
    'Catalyst title': catalyst.event, 'Verification source': catalyst.source || '',
    'Source URL': catalyst.sourceUrl || '', 'Catalyst date': catalyst.date || '',
    'Catalyst category': catalyst.category || normalizeCatalystCategory(catalyst.type) || 'Other',
  };
}

export function normalizeCatalystCategory(input?: string): typeof CATALYST_CATEGORIES[number] | undefined {
  const normalized = input?.trim().toLowerCase();
  return CATALYST_CATEGORIES.find((item) => item.toLowerCase() === normalized);
}

export function ideaStatusLabel(status: IdeaStatus) {
  return IDEA_STATUSES.find((item) => item.toLowerCase() === status) || 'Draft';
}

export function visibleFields(data: Record<string, string>, sectionIndex: number) {
  return IDEA_SECTIONS[sectionIndex].fields.filter((field) => !field.showWhen || field.showWhen(data));
}

export function validateIdeaData(data: Record<string, string>): string[] {
  const missing = IDEA_SECTIONS.flatMap((section) => section.fields)
    .filter((field) => field.required && (!field.showWhen || field.showWhen(data)) && !data[field.name]?.trim())
    .map((field) => field.label);
  const ticker = data.Ticker?.trim();
  if (ticker && !/^[A-Za-z0-9._-]{1,20}$/.test(ticker)) missing.push('Ticker must use 1–20 letters, numbers, periods, dashes, or underscores');
  const sourceUrl = data['Source URL']?.trim();
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) missing.push('Link must start with http:// or https://');
  const contracts = data.Contracts?.trim();
  if (contracts && (!Number.isInteger(Number(contracts)) || Number(contracts) < 1)) missing.push('Number of Contracts must be a positive whole number');
  for (const key of ['Long strike', 'Short strike', 'Net debit']) {
    const input = data[key]?.trim();
    if (input && (!Number.isFinite(Number(input)) || Number(input) <= 0)) missing.push(`${key} must be greater than zero`);
  }
  return missing;
}

const canonicalKeys = IDEA_SECTIONS.flatMap((section) => section.fields.map((field) => field.name)).concat('Candidate ID');

export function canonicalFingerprint(data: Record<string, string>) {
  return JSON.stringify(Object.fromEntries(canonicalKeys.map((key) => [key, data[key]?.trim() || ''])));
}
