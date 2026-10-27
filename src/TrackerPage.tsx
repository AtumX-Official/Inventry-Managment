import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowLeft, ChevronRight, ClipboardList, PackageOpen, Search, Truck, Users, X } from 'lucide-react';
import type { Component } from './inventory';
import { watchDeliveries, type Delivery } from './deliveries';
import { watchAllRequests, type ComponentRequest } from './requests';
import { watchUsers, type Member } from './users';
import { buildMembers, itemTotals, type MemberStats } from './tracker';
import { formatDate, today } from './dates';
import { DeliveryList } from './DeliveriesPage';
import { RequestCard } from './RequestsPage';

function Avatar({ member, size = 'h-9 w-9' }: { member: MemberStats; size?: string }) {
  return member.photoURL ? (
    <img src={member.photoURL} alt="" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full`} />
  ) : (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700`}
    >
      {(member.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function Stat({ label, value, tone = 'text-ink-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tabular-nums sm:text-3xl ${tone}`}>{value}</p>
    </div>
  );
}

function MemberDetail({
  user,
  member,
  components,
  onBack,
}: {
  user: User;
  member: MemberStats;
  components: Component[];
  onBack: () => void;
}) {
  const items = itemTotals(member.deliveries);

  return (
    <div className="mt-8 space-y-8">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> All members
        </button>
        <div className="mt-4 flex items-center gap-4">
          <Avatar member={member} size="h-14 w-14" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-ink-900">{member.name}</h2>
            <p className="truncate text-sm text-ink-500">
              {member.email || 'No account — name typed on a manual delivery'}
            </p>
            {member.lastLoginAt && (
              <p className="text-xs text-ink-500">
                Last login{' '}
                {member.lastLoginAt.toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Items given" value={member.given} />
        <Stat label="Returned" value={member.returned} />
        <Stat label="Still with them" value={member.out} tone={member.out ? 'text-brand-600' : 'text-ink-900'} />
        <Stat
          label="Pending requests"
          value={member.pending}
          tone={member.pending ? 'text-amber-600' : 'text-ink-900'}
        />
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-900">Items</h3>
        {items.length === 0 ? (
          <p className="card text-sm text-ink-500">Nothing has been given to {member.name} yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-ink-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 text-right font-medium">Given</th>
                  <th className="px-4 py-3 text-right font-medium">Returned</th>
                  <th className="px-4 py-3 text-right font-medium">Still with them</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((i) => (
                  <tr key={i.componentId}>
                    <td className="px-4 py-3 font-medium text-ink-900">{i.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-700">{i.given}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-700">{i.returned}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${i.out ? 'text-brand-600' : 'text-ink-400'}`}
                    >
                      {i.out}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-900">
          Deliveries <span className="text-ink-500">({member.deliveries.length})</span>
        </h3>
        {member.deliveries.length === 0 ? (
          <p className="card text-sm text-ink-500">No deliveries.</p>
        ) : (
          <DeliveryList user={user} deliveries={member.deliveries} />
        )}
      </section>

      {member.hasAccount && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-ink-900">
            Requests <span className="text-ink-500">({member.requests.length})</span>
          </h3>
          {member.requests.length === 0 ? (
            <p className="card text-sm text-ink-500">No requests.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {member.requests.map((r) => (
                <RequestCard key={r.id} user={user} request={r} components={components} admin />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function TrackerPage({ user, components }: { user: User; components: Component[] }) {
  const [users, setUsers] = useState<Member[] | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [requests, setRequests] = useState<ComponentRequest[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onError = (e: Error) => {
      console.error(e);
      setError(e.message);
    };
    const stops = [
      watchUsers(setUsers, onError),
      watchDeliveries(setDeliveries, onError),
      watchAllRequests(setRequests, onError),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  if (error) return <p className="card mt-8 text-sm text-red-600">Could not load the tracker: {error}</p>;
  if (!users || !deliveries || !requests) return <p className="mt-8 text-sm text-ink-500">Loading tracker…</p>;

  const members = buildMembers(users, deliveries, requests);
  const current = selected ? members.find((m) => m.key === selected) : undefined;
  if (current) {
    return <MemberDetail user={user} member={current} components={components} onBack={() => setSelected(null)} />;
  }

  const q = search.trim().toLowerCase();
  const shown = members
    .filter((m) => !q || [m.name, m.email].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => b.out - a.out || b.pending - a.pending || a.name.localeCompare(b.name));

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Members" value={members.length} />
        <Stat
          label="Pending requests"
          value={requests.filter((r) => r.status === 'pending').length}
          tone="text-amber-600"
        />
        <Stat label="Items out now" value={members.reduce((n, m) => n + m.out, 0)} tone="text-brand-600" />
        <Stat label="Deliveries today" value={deliveries.filter((d) => d.date === today()).length} />
      </div>

      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-ink-900">Members</h2>
        <div className="relative min-w-0 sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members"
            className="w-full rounded-full border border-ink-200 bg-ink-50 py-2 pl-9 pr-8 text-base text-ink-900 outline-none focus:border-brand-500 sm:text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <Users className="h-10 w-10 text-ink-300" />
          <p className="mt-3 text-ink-600">
            {members.length === 0 ? 'No members yet.' : 'No members match your search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 text-right font-medium">
                  <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
                  Requests
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <Truck className="mr-1 inline h-3.5 w-3.5" />
                  Given
                </th>
                <th className="px-4 py-3 text-right font-medium">Returned</th>
                <th className="px-4 py-3 text-right font-medium">
                  <PackageOpen className="mr-1 inline h-3.5 w-3.5" />
                  Still out
                </th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((m) => (
                <tr key={m.key} onClick={() => setSelected(m.key)} className="cursor-pointer hover:bg-brand-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar member={m} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">{m.name}</p>
                        <p className="truncate text-xs text-ink-500">{m.email || 'No account'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink-700">
                    {m.requests.length}
                    {m.pending > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {m.pending} pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-700">{m.given}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-700">{m.returned}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${m.out ? 'text-brand-600' : 'text-ink-400'}`}
                  >
                    {m.out}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                    {m.lastActivity ? formatDate(m.lastActivity) : '—'}
                  </td>
                  <td className="pr-3 text-ink-400">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
