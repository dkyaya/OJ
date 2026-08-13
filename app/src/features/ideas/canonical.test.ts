import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../../data/demo';
import {
  canonicalFingerprint, CATALYST_CATEGORIES, IDEA_SECTIONS, IDEA_STATUSES,
  ideaStatusLabel, ideaToFormData, initialIdeaData, normalizeCatalystCategory,
  validateIdeaData,
} from './canonical';

describe('canonical Idea workflow — 40 functional cases', () => {
  it.each(IDEA_STATUSES)('accepts the %s Idea status', (status) => {
    expect(ideaStatusLabel(status.toLowerCase() as Parameters<typeof ideaStatusLabel>[0])).toBe(status);
  });

  it.each(CATALYST_CATEGORIES)('accepts the %s catalyst category', (category) => {
    expect(normalizeCatalystCategory(category.toLowerCase())).toBe(category);
  });

  it.each([
    ['Setup', ['Ticker', 'Asset Type', 'Strategy', 'Bias', 'Status']],
    ['Catalyst', ['Catalyst', 'Scheduled Catalyst', 'Event Name', 'Source', 'Link', 'Date', 'Category']],
    ['Research', ['Thesis', 'Evidence', 'Entry Conditions', 'Planned Exit', 'Invalidation', 'Hold Through', 'Avoid']],
    ['Candidate', ['Expiration', 'Long Strike', 'Short Strike', 'Net Debit', 'Number of Contracts', 'Confidence']],
  ] as const)('uses the canonical %s section inventory', (title, labels) => {
    const section = IDEA_SECTIONS.find((item) => item.title === title);
    expect(section?.fields.map((field) => field.label)).toEqual(labels);
  });

  const valid = { ...initialIdeaData(), Ticker: 'TEST', Thesis: 'Synthetic thesis.' };
  it.each([
    ['valid base form', valid, undefined],
    ['invalid ticker', { ...valid, Ticker: 'BAD TICKER!' }, 'Ticker must'],
    ['missing ticker', { ...valid, Ticker: '' }, 'Ticker'],
    ['missing thesis', { ...valid, Thesis: '' }, 'Thesis'],
    ['new catalyst without event', { ...valid, 'Catalyst setup': 'Create New', 'Catalyst date': '2026-08-15' }, 'Event Name'],
    ['invalid source link', { ...valid, 'Catalyst setup': 'Create New', 'Catalyst title': 'Synthetic event', 'Catalyst date': '2026-08-15', 'Source URL': 'example.invalid' }, 'Link must'],
    ['fractional contracts', { ...valid, Contracts: '1.5' }, 'positive whole'],
    ['invalid long strike', { ...valid, 'Long strike': '-1' }, 'Long strike'],
    ['invalid short strike', { ...valid, 'Short strike': 'zero' }, 'Short strike'],
    ['invalid debit', { ...valid, 'Net debit': '0' }, 'Net debit'],
  ] as const)('validates %s', (_name, data, expected) => {
    const errors = validateIdeaData(data);
    if (expected) expect(errors.join(' ')).toContain(expected); else expect(errors).toEqual([]);
  });

  const idea = demoWorkspace.ideas[0];
  it('prepopulates the existing ticker', () => expect(ideaToFormData(idea).Ticker).toBe('DEMO'));
  it('prepopulates the same Idea candidate identity', () => expect(ideaToFormData(idea)['Candidate ID']).toBe(idea.candidates[0].id));
  it('hides legacy candidate labels from canonical data', () => expect(canonicalFingerprint(ideaToFormData(idea))).not.toContain('Balanced'));
  it('prepopulates the linked catalyst', () => expect(ideaToFormData(idea)['Existing catalyst ID']).toBe(idea.catalystId));
  it('detects a meaningful edit', () => expect(canonicalFingerprint({ ...valid, Thesis: 'Changed' })).not.toBe(canonicalFingerprint(valid)));
  it('treats surrounding whitespace as a no-op', () => expect(canonicalFingerprint({ ...valid, Thesis: '  Synthetic thesis.  ' })).toBe(canonicalFingerprint(valid)));
});
