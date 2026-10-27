import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { Plus, RotateCcw, Search, Truck, X } from 'lucide-react';
import type { Component } from './inventory';
import { createDelivery, returnItems, statusOf, watchDeliveries, type Delivery, type Status } from './deliveries';
import { checkDate, dayLabel, formatDate, today } from './dates';
import { ItemPicker, Modal } from './ui';
import { checkLines, emptyLine, field, fieldBase, nameOf, type Line } from './lines';

function NewDeliveryForm({ user, components, onClose }: { user: User; components: Component[]; onClose: () => void }) {
  const [givenTo, setGivenTo] = useState('');
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!givenTo.trim()) return setError('Enter who the items are given to.');
    const badDate = checkDate(date);
    if (badDate) return setError(badDate);
    const problem = checkLines(lines, components);
    if (problem) return setError(problem);

    setSaving(true);
    setError('');
    try {
      await createDelivery(
        { givenTo: givenTo.trim(), date, deliveredBy: nameOf(user), uid: user.uid, note: note.trim() },
        lines.filter((l) => l.componentId),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the delivery');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mb-6 space-y-4">
      <h3 className="font-semibold text-ink-900">New delivery</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-600">
          Given to
          <input
            autoFocus
            className={`${field} mt-1`}
            value={givenTo}
            onChange={(e) => setGivenTo(e.target.value)}
            placeholder="Person's name"
          />
        </label>
        <label className="text-xs text-ink-600">
          Date
          <input
            type="date"
            max={today()}
            required
            className={`${field} mt-1`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      <ItemPicker components={components} lines={lines} onChange={setLines} />

      <label className="block text-xs text-ink-600">
        Notes (optional)
        <textarea
          rows={2}
          className={`${field} mt-1 resize-none`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. For the drone project, return by Friday"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Saving…' : 'Confirm delivery'}
        </button>
      </div>
    </form>
  );
}

function ReturnForm({ user, delivery, onClose }: { user: User; delivery: Delivery; onClose: () => void }) {
  const out = delivery.items.filter((i) => i.quantity - i.returned > 0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const lines = out
      .map((i) => ({ componentId: i.componentId, quantity: qty[i.componentId] ?? 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) return setError('Enter a quantity for at least one item.');
    const badDate = checkDate(date, delivery.date);
    if (badDate) return setError(badDate);

    setSaving(true);
    setError('');
    try {
      await returnItems(delivery.id, { date, by: nameOf(user) }, lines);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the return');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-ink-600">
        Return date
        <input
          type="date"
          min={delivery.date}
          max={today()}
          required
          className={`${field} mt-1`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <p className="pt-1 text-xs text-ink-600">Quantity coming back</p>
      {out.map((i) => {
        const left = i.quantity - i.returned;
        return (
          <div key={i.componentId} className="flex items-center gap-3">
            <span className="flex-1 text-sm text-ink-700">
              {i.name} <span className="text-ink-500">({left} still out)</span>
            </span>
            <input
              type="number"
              min={0}
              max={left}
              className={`${fieldBase} w-24 shrink-0`}
              value={qty[i.componentId] ?? 0}
              onChange={(e) => setQty({ ...qty, [i.componentId]: Math.min(left, Math.max(0, Number(e.target.value))) })}
              aria-label={`Quantity of ${i.name} to return`}
            />
            <button
              type="button"
              onClick={() => setQty({ ...qty, [i.componentId]: left })}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              All
            </button>
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-ghost py-2">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary py-2 disabled:opacity-60">
          {saving ? 'Saving…' : 'Confirm return'}
        </button>
      </div>
    </form>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  Delivered: 'bg-amber-100 text-amber-600',
  'Partly returned': 'bg-sky-100 text-sky-700',
  Returned: 'bg-brand-500/10 text-brand-700',
};

function DeliveryCard({ user, delivery }: { user: User; delivery: Delivery }) {
  const [returning, setReturning] = useState(false);
  const closeReturn = useCallback(() => setReturning(false), []);
  const status = statusOf(delivery);

  const canReturn = status !== 'Returned';

  return (
    <>
      <div
        onClick={() => canReturn && setReturning(true)}
        className={`card ${canReturn ? 'cursor-pointer select-none hover:border-brand-500/40' : ''}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-ink-900">Given to {delivery.givenTo}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {formatDate(delivery.date)} · by {delivery.deliveredBy}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="py-1.5 pr-4 font-medium">Item</th>
                <th className="py-1.5 pr-4 text-right font-medium">Given</th>
                <th className="py-1.5 pr-4 text-right font-medium">Returned</th>
                <th className="py-1.5 text-right font-medium">Still out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {delivery.items.map((i) => (
                <tr key={i.componentId}>
                  <td className="py-1.5 pr-4 text-ink-900">{i.name}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-ink-700">{i.quantity}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-ink-700">{i.returned}</td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${i.quantity - i.returned ? 'text-amber-600' : 'text-ink-500'}`}
                  >
                    {i.quantity - i.returned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {delivery.note && (
          <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
            <span className="font-medium text-ink-900">Note:</span> {delivery.note}
          </p>
        )}

        {delivery.returns.length > 0 && (
          <div className="mt-4 border-t border-ink-200 pt-3">
            <p className="text-xs uppercase tracking-wider text-ink-500">Returns</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-600">
              {delivery.returns.map((r, k) => (
                <li key={k}>
                  <span className="text-ink-700">{formatDate(r.date)}</span> ·{' '}
                  {r.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}{' '}
                  <span className="text-ink-500">(received by {r.by})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canReturn && (
          <p className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600">
            <RotateCcw className="h-3.5 w-3.5" /> Click to return items
          </p>
        )}
      </div>

      {returning && (
        <Modal
          title="Return items to inventory"
          subtitle={`Given to ${delivery.givenTo} · ${formatDate(delivery.date)}`}
          onClose={closeReturn}
        >
          <ReturnForm user={user} delivery={delivery} onClose={closeReturn} />
        </Modal>
      )}
    </>
  );
}

// Deliveries grouped by delivery date, newest day first, so today's deliveries sit on top.
export function DeliveryList({ user, deliveries }: { user: User; deliveries: Delivery[] }) {
  const groups = new Map<string, Delivery[]>();
  // Stable sort keeps the newest-recorded delivery first within a day.
  for (const d of [...deliveries].sort((a, b) => b.date.localeCompare(a.date))) {
    groups.set(d.date, [...(groups.get(d.date) ?? []), d]);
  }

  return (
    <div className="space-y-8">
      {[...groups].map(([date, list]) => (
        <section key={date}>
          <h3 className="mb-3 flex items-center gap-3 text-sm font-semibold text-ink-900">
            <span className={date === today() ? 'rounded-full bg-brand-500 px-3 py-1 text-white' : ''}>
              {dayLabel(date)}
            </span>
            {date === today() && <span className="font-normal text-ink-500">{formatDate(date)}</span>}
            <span className="h-px flex-1 bg-ink-200" />
            <span className="text-xs font-normal text-ink-500">
              {list.length} {list.length === 1 ? 'delivery' : 'deliveries'}
            </span>
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {list.map((d) => (
              <DeliveryCard key={d.id} user={user} delivery={d} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Deliveries({ user, components }: { user: User; components: Component[] }) {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(
    () =>
      watchDeliveries(setDeliveries, (e) => {
        console.error(e);
        setError(e.message);
      }),
    [],
  );

  const q = search.trim().toLowerCase();
  const shown = (deliveries ?? []).filter(
    (d) =>
      !q ||
      [d.givenTo, d.deliveredBy, formatDate(d.date), statusOf(d), ...d.items.map((i) => i.name)].some((v) =>
        v.toLowerCase().includes(q),
      ),
  );

  return (
    <>
      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-ink-900">
          Deliveries {deliveries && <span className="text-ink-500">({deliveries.length})</span>}
        </h2>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deliveries"
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
          {!adding && (
            <button onClick={() => setAdding(true)} className="btn-primary py-2">
              <Plus className="h-4 w-4" /> New delivery
            </button>
          )}
        </div>
      </div>

      {adding && <NewDeliveryForm user={user} components={components} onClose={() => setAdding(false)} />}

      {error ? (
        <p className="card text-sm text-red-600">Could not load deliveries: {error}</p>
      ) : deliveries === null ? (
        <p className="text-sm text-ink-500">Loading deliveries…</p>
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <Truck className="h-10 w-10 text-ink-300" />
          <p className="mt-3 text-ink-600">
            {deliveries.length === 0
              ? 'No deliveries yet. Click New delivery to give items to someone.'
              : 'No deliveries match your search.'}
          </p>
        </div>
      ) : (
        <DeliveryList user={user} deliveries={shown} />
      )}
    </>
  );
}
