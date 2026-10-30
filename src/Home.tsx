import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { signOut, type User } from 'firebase/auth';
import { ClipboardList, LogOut, Package, Pencil, Plus, Search, Truck, UserCog, Users, X } from 'lucide-react';
import { auth } from './firebase';
import { addComponent, updateComponent, watchComponents, type Component, type NewComponent } from './inventory';
import { checkDate, formatDate, today } from './dates';
import Deliveries from './DeliveriesPage';
import RequestsPage from './RequestsPage';
import TrackerPage from './TrackerPage';
import UsersPage from './UsersPage';
import { isAdmin } from './roles';
import { Modal } from './ui';
import { field } from './lines';

const emptyForm = (): NewComponent => ({ name: '', category: '', quantity: 0, date: today(), givenBy: '' });

type View = 'components' | 'requests' | 'delivery' | 'tracker' | 'users';

// The admin manages stock, requests and deliveries; everyone else can browse stock and request it.
const viewsFor = (admin: boolean) =>
  admin
    ? [
        { key: 'components' as View, label: 'Components', desc: 'Stock list', icon: Package },
        { key: 'requests' as View, label: 'Requests', desc: 'Approve & deliver', icon: ClipboardList },
        { key: 'delivery' as View, label: 'Delivery', desc: 'Give & return items', icon: Truck },
        { key: 'tracker' as View, label: 'Tracker', desc: 'Members overview', icon: Users },
        { key: 'users' as View, label: 'Users', desc: 'Login accounts', icon: UserCog },
      ]
    : [
        { key: 'components' as View, label: 'Components', desc: 'Stock list', icon: Package },
        { key: 'requests' as View, label: 'Request', desc: 'Ask for components', icon: ClipboardList },
      ];

// Add/edit form for a component. Inline (under the list header) when adding, stacked in a popup when editing.
function ComponentForm({
  initial,
  onSave,
  onClose,
  inline = false,
}: {
  initial: NewComponent;
  onSave: (item: NewComponent) => Promise<unknown>;
  onClose: () => void;
  inline?: boolean;
}) {
  const [form, setForm] = useState<NewComponent>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Enter a name.');
    if (!Number.isInteger(form.quantity) || form.quantity < 0) return setError('Quantity must be 0 or more.');
    const badDate = checkDate(form.date);
    if (badDate) return setError(badDate);
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, name: form.name.trim(), category: form.category.trim(), givenBy: form.givenBy.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setSaving(false);
    }
  };

  // Column spans only apply in the inline 6-column layout; in the popup every field takes a full row.
  const span = (n: 2 | 6) => (inline ? (n === 2 ? 'sm:col-span-2' : 'sm:col-span-6') : '');

  return (
    <form onSubmit={submit} className={inline ? 'card mb-6 grid gap-3 sm:grid-cols-6 sm:items-end' : 'grid gap-3'}>
      <label className={`text-xs text-ink-600 ${span(2)}`}>
        Name
        <input
          autoFocus
          required
          className={`${field} mt-1`}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="ESP32 DevKit"
        />
      </label>
      <label className="text-xs text-ink-600">
        Category
        <input
          className={`${field} mt-1`}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Microcontroller"
        />
      </label>
      <label className="text-xs text-ink-600">
        Quantity
        <input
          type="number"
          min={0}
          className={`${field} mt-1`}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
        />
      </label>
      <label className="text-xs text-ink-600">
        Date
        <input
          type="date"
          max={today()}
          required
          className={`${field} mt-1`}
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </label>
      <label className="text-xs text-ink-600">
        Given By
        <input
          className={`${field} mt-1`}
          value={form.givenBy}
          onChange={(e) => setForm({ ...form, givenBy: e.target.value })}
          placeholder="Name"
        />
      </label>
      {error && <p className={`text-sm text-red-600 ${span(6)}`}>{error}</p>}
      <div className={`flex justify-end gap-2 pt-1 ${span(6)}`}>
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Saving…' : inline ? 'Save component' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

export default function Home({ user }: { user: User }) {
  const [items, setItems] = useState<Component[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const closeEdit = useCallback(() => setEditing(null), []);
  const [view, setView] = useState<View>('components');
  const admin = isAdmin(user);
  const views = viewsFor(admin);

  useEffect(
    () =>
      watchComponents(setItems, (e) => {
        console.error(e);
        setError(e.message);
      }),
    [],
  );

  const q = search.trim().toLowerCase();
  const shown = (items ?? []).filter(
    (c) =>
      !q ||
      [c.name, c.category, ...(admin ? [c.givenBy, formatDate(c.date)] : [])].some((v) => v.toLowerCase().includes(q)),
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="container-px flex h-14 items-center justify-between gap-3 sm:h-16">
          <span className="truncate font-display text-base font-bold text-ink-900 sm:text-lg">
            <span className="text-brand-600">AtumX</span> Inventory
          </span>
          <div className="flex items-center gap-3">
            {user.photoURL && (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />
            )}
            <span className="hidden text-sm text-ink-600 sm:inline">{user.displayName ?? user.email}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                admin ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-600'
              }`}
            >
              {admin ? 'Admin' : 'User'}
            </span>
            <button
              onClick={() => signOut(auth)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:text-ink-900"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="container-px py-6 sm:py-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Welcome to <span className="text-brand-600">AtumX</span> Inventory Management
        </h1>

        <nav
          className={`mt-6 grid gap-3 sm:mt-8 sm:gap-4 ${admin ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:max-w-xl'}`}
        >
          {views.map(({ key, label, desc, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition sm:flex-row sm:gap-4 sm:p-4 sm:text-left ${
                view === key
                  ? 'border-brand-500/60 bg-brand-500/10'
                  : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-12 sm:w-12 ${
                  view === key ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900 sm:text-base">{label}</span>
                <span className="hidden text-xs text-ink-500 sm:block">{desc}</span>
              </span>
            </button>
          ))}
        </nav>

        {view === 'users' && admin ? (
          <UsersPage />
        ) : view === 'tracker' && admin ? (
          <TrackerPage user={user} components={items ?? []} />
        ) : view === 'delivery' && admin ? (
          <Deliveries user={user} components={items ?? []} />
        ) : view === 'requests' ? (
          <RequestsPage user={user} components={items ?? []} admin={admin} />
        ) : (
          <>
            <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-ink-900">
                Components {items && <span className="text-ink-500">({items.length})</span>}
              </h2>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search components"
                    className="w-full rounded-full border border-ink-200 bg-ink-50 py-2 pl-9 pr-8 text-sm text-ink-900 outline-none focus:border-brand-500"
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
                {admin && !adding && (
                  <button onClick={() => setAdding(true)} className="btn-primary py-2">
                    <Plus className="h-4 w-4" /> Add
                  </button>
                )}
              </div>
            </div>

            {admin && adding && (
              <ComponentForm
                inline
                initial={emptyForm()}
                onSave={(item) => addComponent(item, user.uid)}
                onClose={() => setAdding(false)}
              />
            )}

            {admin && editing && (
              <Modal title="Edit component" subtitle={editing.name} onClose={closeEdit}>
                <ComponentForm
                  initial={{
                    name: editing.name,
                    category: editing.category,
                    quantity: editing.quantity,
                    date: editing.date || today(),
                    givenBy: editing.givenBy,
                  }}
                  onSave={(item) => updateComponent(editing.id, item, user.uid)}
                  onClose={closeEdit}
                />
              </Modal>
            )}

            {error ? (
              <p className="card text-sm text-red-600">Could not load components: {error}</p>
            ) : items === null ? (
              <p className="text-sm text-ink-500">Loading components…</p>
            ) : shown.length === 0 ? (
              <div className="card flex flex-col items-center py-12 text-center">
                <Package className="h-10 w-10 text-ink-300" />
                <p className="mt-3 text-ink-600">
                  {items.length === 0
                    ? admin
                      ? 'No components yet. Click Add to create the first one.'
                      : 'No components in stock yet.'
                    : 'No components match your search.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-ink-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 text-right font-medium">Quantity</th>
                      {admin && (
                        <>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Given By</th>
                          <th className="w-12 px-4 py-3">
                            <span className="sr-only">Edit</span>
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {shown.map((c) => (
                      <tr key={c.id} className="hover:bg-brand-50/60">
                        <td className="px-4 py-3 font-medium text-ink-900">{c.name}</td>
                        <td className="px-4 py-3 text-ink-600">{c.category || '—'}</td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${c.quantity === 0 ? 'text-red-600' : 'text-ink-900'}`}
                        >
                          {c.quantity}
                        </td>
                        {admin && (
                          <>
                            <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatDate(c.date) || '—'}</td>
                            <td className="px-4 py-3 text-ink-600">{c.givenBy || '—'}</td>
                            <td className="px-2 py-2 text-right">
                              <button
                                onClick={() => setEditing(c)}
                                className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-brand-100 hover:text-brand-700"
                                aria-label={`Edit ${c.name}`}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
