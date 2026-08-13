export type OfficialCompanySourceKind = 'investor_relations' | 'earnings_results' | 'events_presentations' | 'sec_filings' | 'guidance_materials';
export type OfficialCompanySource = { ticker: string; kind: OfficialCompanySourceKind; label: string; url: string; secCik?: string };

export function secCompanyFilingsUrl(cik: string) {
  const digits = cik.replace(/\D/g, '');
  if (!/^\d{1,10}$/.test(digits)) return undefined;
  const normalized = digits.padStart(10, '0');
  if (!/^\d{10}$/.test(normalized)) return undefined;
  return `https://www.sec.gov/edgar/browse/?CIK=${normalized}&owner=exclude`;
}

export function validateOfficialCompanySource(input: OfficialCompanySource) {
  if (!/^[A-Z0-9._-]{1,20}$/.test(input.ticker.trim().toUpperCase()) || !input.label.trim()) return undefined;
  try {
    const url = new URL(input.url);
    if (url.protocol !== 'https:') return undefined;
    return { ...input, ticker: input.ticker.trim().toUpperCase(), label: input.label.trim(), url: url.toString() };
  } catch { return undefined; }
}

export const officialCompanySourceKinds: Array<{ kind: OfficialCompanySourceKind; label: string; guidance: string }> = [
  { kind: 'investor_relations', label: 'Investor Relations', guidance: 'Canonical company communications home.' },
  { kind: 'earnings_results', label: 'Earnings / Results', guidance: 'Official releases and financial results.' },
  { kind: 'events_presentations', label: 'Events / Presentations', guidance: 'Verified event times, decks, and webcast links.' },
  { kind: 'sec_filings', label: 'SEC Filings', guidance: 'Canonical automated filing source; a filing timestamp is not automatically an earnings timestamp.' },
  { kind: 'guidance_materials', label: 'Guidance Materials', guidance: 'Company-authored outlook and guidance documents.' },
];
