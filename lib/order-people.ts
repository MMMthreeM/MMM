import { readUsers } from './sheet-table';
import type { OrderRow } from './order-view';

export function registeredCrews(users: unknown[][]) {
  const crews = new Map<string, Set<string>>();
  for (const user of readUsers(users)) {
    if (user.role !== 'User' || !user.company) continue;
    const regions = crews.get(user.company) || new Set<string>();
    regions.add(user.region.trim()); crews.set(user.company, regions);
  }
  // A conflicting directory entry must be corrected, rather than guessing its region.
  return [...crews].filter(([, regions]) => regions.size === 1).map(([company, regions]) => ({ company, region: [...regions][0] })).sort((a,b) => a.company.localeCompare(b.company, 'zh-TW'));
}

export function userNicknames(users: unknown[][]): ReadonlyMap<string, string> {
  return new Map(readUsers(users).filter(user => user.name.trim()).map(user => [user.email.trim().toLowerCase(), user.name.trim()]));
}

export function nicknameForStoredPerson(value: string, names: ReadonlyMap<string, string>) {
  return names.get(value.trim().toLowerCase()) || value;
}

/** Display older email-based records without rewriting source data or audit identities. */
export function displayOrderPeople(rows: OrderRow[], names: ReadonlyMap<string, string>) {
  return rows.map(row => ({ ...row, reqUser: nicknameForStoredPerson(row.reqUser, names), adminUser: nicknameForStoredPerson(row.adminUser, names),
    history: row.history?.map(event => ({ ...event, actor: nicknameForStoredPerson(event.actor, names) })),
  }));
}

/** Notifications use the creator's stable identity; never pick arbitrarily between equal nicknames. */
export function requesterForNotification(row: OrderRow, users: unknown[][]) {
  const accounts = readUsers(users);
  const creator = row.history?.find(event => ['ORDER_CREATED', 'DRAFT_CREATED'].includes(event.eventType))?.actor;
  const principal = creator || row.reqUser;
  const byEmail = accounts.find(user => user.email.toLowerCase() === principal.trim().toLowerCase());
  if (creator || byEmail) return byEmail;
  const matches = accounts.filter(user => user.name === row.reqUser && user.company === row.reqCompany);
  return matches.length === 1 ? matches[0] : undefined;
}
