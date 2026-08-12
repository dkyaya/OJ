export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const isPastCalendarDate = (date: Date | string, today = new Date()) => {
  const key = typeof date === 'string' ? date : dateKey(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && key < dateKey(today);
};

export const isPastCalendarEvent = (eventAt?: string, date?: string, now = new Date()) => {
  const eventTime = eventAt ? Date.parse(eventAt) : Number.NaN;
  return Number.isFinite(eventTime) ? eventTime <= now.getTime() : Boolean(date && isPastCalendarDate(date, now));
};
