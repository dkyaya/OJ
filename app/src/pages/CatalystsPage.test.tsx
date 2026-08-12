import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { dateKey, isPastCalendarDate, isPastCalendarEvent } from '../lib/calendar';
import { Agenda, MonthCalendar } from './CatalystsPage';

describe('calendar date keys', () => {
  it('uses the local calendar day instead of UTC rollover', () => {
    expect(dateKey(new Date(2026, 7, 8, 23, 30))).toBe('2026-08-08');
  });

  it('treats earlier days as past while keeping today current', () => {
    const today = new Date(2026, 7, 11, 12);
    expect(isPastCalendarDate('2026-08-10', today)).toBe(true);
    expect(isPastCalendarDate('2026-08-11', today)).toBe(false);
    expect(isPastCalendarDate('2026-08-12', today)).toBe(false);
  });

  it('marks a catalyst past as soon as its scheduled cutoff passes', () => {
    const now = new Date('2026-08-11T15:00:00Z');
    expect(isPastCalendarEvent('2026-08-11T14:59:00Z', '2026-08-11', now)).toBe(true);
    expect(isPastCalendarEvent('2026-08-11T15:01:00Z', '2026-08-11', now)).toBe(false);
  });

  it('marks past month and agenda events without disabling their buttons', () => {
    const pastCatalyst = { ...demoWorkspace.catalysts[0], date: '2026-08-10', event: 'Past release' };
    const today = new Date(2026, 7, 11, 12);
    const month = renderToStaticMarkup(<MonthCalendar focus={today} today={today} catalysts={[pastCatalyst]} onOpen={() => undefined} />);
    const agenda = renderToStaticMarkup(<Agenda focus={new Date(2026, 7, 10)} today={today} catalysts={[pastCatalyst]} view="day" onOpen={() => undefined} />);

    expect(month).toContain('class="past"><time dateTime="2026-08-10"');
    expect(month).toContain('class="event-chip macro past"');
    expect(agenda).toContain('<section class="past">');
    expect(agenda).toContain('class="agenda-event macro past"');
    expect(month).not.toContain('disabled');
    expect(agenda).not.toContain('disabled');
  });
});
