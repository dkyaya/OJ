const partsInZone = (date: Date, timeZone: string) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
) as Record<string, number>;

export function zonedEventIso(date: string, time: string, timeZone: string) {
  const match = `${date}T${time}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Use a valid event date and time.');
  const [, year, month, day, hour, minute] = match.map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const zoned = partsInZone(new Date(instant), timeZone);
    const represented = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour === 24 ? 0 : zoned.hour, zoned.minute, zoned.second);
    instant += desired - represented;
  }
  const result = new Date(instant);
  const roundTrip = partsInZone(result, timeZone);
  if (roundTrip.year !== year || roundTrip.month !== month || roundTrip.day !== day || roundTrip.hour % 24 !== hour || roundTrip.minute !== minute) {
    throw new Error('That local time does not exist in the selected timezone.');
  }
  return result.toISOString();
}

