import type { Delivery } from './deliveries';
import type { ComponentRequest } from './requests';
import type { Member } from './users';

export type MemberStats = {
  key: string;
  name: string;
  email: string;
  photoURL: string;
  lastLoginAt: Date | null;
  // false for someone who only appears as a typed name on a manual delivery.
  hasAccount: boolean;
  deliveries: Delivery[];
  requests: ComponentRequest[];
  given: number;
  returned: number;
  out: number;
  pending: number;
  // Latest delivery, return or request date as YYYY-MM-DD, or '' if none.
  lastActivity: string;
};

export type ItemTotals = { componentId: string; name: string; given: number; returned: number; out: number };

const dayOf = (d: Date | null) => (d ? d.toLocaleDateString('en-CA') : '');

// The latest of some YYYY-MM-DD dates ('' counts as no date).
const latest = (...dates: string[]) => dates.reduce((a, b) => (b > a ? b : a), '');

// Combines members, deliveries and requests into one row per person.
// Deliveries made from a request carry the member's uid; manual deliveries only have the typed
// "Given to" name, which is matched to a member by display name when possible.
export function buildMembers(users: Member[], deliveries: Delivery[], requests: ComponentRequest[]): MemberStats[] {
  const rows = new Map<string, MemberStats>();
  const uidByName = new Map(users.map((u) => [u.name.trim().toLowerCase(), u.uid]));

  const row = (key: string, seed: Partial<MemberStats>) => {
    let r = rows.get(key);
    if (!r) {
      r = {
        key,
        name: '',
        email: '',
        photoURL: '',
        lastLoginAt: null,
        hasAccount: false,
        deliveries: [],
        requests: [],
        given: 0,
        returned: 0,
        out: 0,
        pending: 0,
        lastActivity: '',
        ...seed,
      };
      rows.set(key, r);
    }
    return r;
  };

  for (const u of users) {
    row(u.uid, { name: u.name, email: u.email, photoURL: u.photoURL, lastLoginAt: u.lastLoginAt, hasAccount: true });
  }

  for (const d of deliveries) {
    const typed = d.givenTo.trim();
    const key = d.userId || uidByName.get(typed.toLowerCase()) || `name:${typed.toLowerCase()}`;
    const r = row(key, { name: typed });
    r.deliveries.push(d);
    for (const i of d.items) {
      r.given += i.quantity;
      r.returned += i.returned;
      r.out += i.quantity - i.returned;
    }
    const dates = [d.date, ...d.returns.map((x) => x.date)];
    r.lastActivity = latest(r.lastActivity, ...dates);
  }

  for (const q of requests) {
    const r = row(q.userId, { name: q.userName, email: q.userEmail, hasAccount: true });
    r.requests.push(q);
    if (q.status === 'pending') r.pending += 1;
    r.lastActivity = latest(r.lastActivity, dayOf(q.createdAt));
  }

  return [...rows.values()];
}

// Per-component totals across all of one member's deliveries.
export function itemTotals(deliveries: Delivery[]): ItemTotals[] {
  const totals = new Map<string, ItemTotals>();
  for (const d of deliveries) {
    for (const i of d.items) {
      const t = totals.get(i.componentId) ?? {
        componentId: i.componentId,
        name: i.name,
        given: 0,
        returned: 0,
        out: 0,
      };
      t.given += i.quantity;
      t.returned += i.returned;
      t.out += i.quantity - i.returned;
      totals.set(i.componentId, t);
    }
  }
  return [...totals.values()].sort((a, b) => b.out - a.out || a.name.localeCompare(b.name));
}
