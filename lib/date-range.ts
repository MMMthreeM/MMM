export function taipeiDate(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function isQueryDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
  return year >= 1 && date.toISOString().slice(0, 10) === value;
}
export function taipeiDateTime(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 16); }
export function recentMonthRange(now = Date.now()) {
  const endDate = taipeiDate(now);
  const [year, month, day] = endDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const startDate = new Date(Date.UTC(year, month - 2, Math.min(day, lastDay))).toISOString().slice(0, 10);
  return { startDate, endDate };
}
