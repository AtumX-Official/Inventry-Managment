import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Search, Users, X } from 'lucide-react';
import { watchUsers, type Member } from './users';
import { ADMIN_EMAIL } from './roles';
import { Modal } from './ui';

const formatTime = (d: Date | null) =>
  d
    ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

// A short "Browser on OS" description of a user agent string.
function deviceOf(ua: string) {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`;
}

function Avatar({ member, size = 'h-9 w-9' }: { member: Member; size?: string }) {
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

function UserDetails({ member }: { member: Member }) {
  const rows: [string, string][] = [
    ['Name', member.name],
    ['Email', member.email || '—'],
    ['Email verified', member.emailVerified ? 'Yes' : 'No'],
    ['Role', member.email === ADMIN_EMAIL ? 'Admin' : 'User'],
    ['Phone', member.phoneNumber || '—'],
    ['First login', formatTime(member.firstLoginAt)],
    ['Last login', formatTime(member.lastLoginAt)],
    ['Device', deviceOf(member.userAgent)],
    ['Language', member.language || '—'],
    ['User ID', member.uid],
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Avatar member={member} size="h-16 w-16" />
      </div>
      <dl className="divide-y divide-ink-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 py-2">
            <dt className="w-28 shrink-0 text-ink-500">{label}</dt>
            <dd className="min-w-0 break-all text-ink-900">{value}</dd>
          </div>
        ))}
      </dl>
      {member.userAgent && (
        <p className="break-all rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">{member.userAgent}</p>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);
  const close = useCallback(() => setSelected(null), []);

  useEffect(
    () =>
      watchUsers(setUsers, (e) => {
        console.error(e);
        setError(e.message);
      }),
    [],
  );

  const q = search.trim().toLowerCase();
  const shown = (users ?? [])
    .filter((u) => !q || [u.name, u.email].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => (b.lastLoginAt?.getTime() ?? 0) - (a.lastLoginAt?.getTime() ?? 0));

  return (
    <>
      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-ink-900">
          Users {users && <span className="text-ink-500">({users.length})</span>}
        </h2>
        <div className="relative min-w-0 sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users"
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

      {error ? (
        <p className="card text-sm text-red-600">Could not load users: {error}</p>
      ) : users === null ? (
        <p className="text-sm text-ink-500">Loading users…</p>
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <Users className="h-10 w-10 text-ink-300" />
          <p className="mt-3 text-ink-600">
            {users.length === 0 ? 'No one has logged in yet.' : 'No users match your search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">First login</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium">Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((u) => (
                <tr key={u.uid} onClick={() => setSelected(u)} className="cursor-pointer hover:bg-brand-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar member={u} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate font-medium text-ink-900">
                          {u.name}
                          {u.emailVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-500" />}
                        </p>
                        <p className="truncate text-xs text-ink-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.email === ADMIN_EMAIL ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      {u.email === ADMIN_EMAIL ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatTime(u.firstLoginAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatTime(u.lastLoginAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">{deviceOf(u.userAgent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Modal title={selected.name} subtitle={selected.email} onClose={close}>
          <UserDetails member={selected} />
        </Modal>
      )}
    </>
  );
}
