export function taipeiDate(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function taipeiDateTime(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 16); }
export function recentMonthRange(now = Date.now()) {
  const endDate = taipeiDate(now);
  const [year, month, day] = endDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const startDate = new Date(Date.UTC(year, month - 2, Math.min(day, lastDay))).toISOString().slice(0, 10);
  return { startDate, endDate };
}
