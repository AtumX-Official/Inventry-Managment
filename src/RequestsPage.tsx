import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { Check, ClipboardList, PackageCheck, Plus, Send, X } from 'lucide-react';
import type { Component } from './inventory';
import { createDelivery, watchMyDeliveries, type Delivery } from './deliveries';
import {
  rejectRequest,
  sendRequest,
  watchAllRequests,
  watchMyRequests,
  type ComponentRequest,
  type RequestStatus,
} from './requests';
import { checkDate, formatDate, today } from './dates';
import { ItemPicker, Modal } from './ui';
import { checkLines, emptyLine, field, fieldBase, nameOf, type Line } from './lines';

const formatTime = (d: Date | null) =>
  d
    ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Just now';

const STATUS: Record<RequestStatus, { label: string; style: string }> = {
  pending: { label: 'Pending', style: 'bg-amber-100 text-amber-700' },
  delivered: { label: 'Delivered', style: 'bg-brand-100 text-brand-700' },
  rejected: { label: 'Rejected', style: 'bg-red-100 text-red-700' },
};

function NewRequestForm({ user, components, onClose }: { user: User; components: Component[]; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = checkLines(lines, components);
    if (problem) return setError(problem);

    setSaving(true);
    setError('');
    try {
      const items = lines
        .filter((l) => l.componentId)
        .map((l) => ({
          componentId: l.componentId,
          name: components.find((c) => c.id === l.componentId)?.name ?? '',
          quantity: l.quantity,
        }));
      await sendRequest({ uid: user.uid, name: nameOf(user), email: user.email ?? '' }, items, note.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mb-6 space-y-4">
      <h3 className="font-semibold text-ink-900">Request components</h3>
      <ItemPicker components={components} lines={lines} onChange={setLines} />
      <label className="block text-xs text-ink-600">
        Note (optional)
        <textarea
          rows={2}
          className={`${field} mt-1 resize-none`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What is it for?"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
          <Send className="h-4 w-4" /> {saving ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </form>
  );
}

function AcceptForm({
  user,
  request,
  components,
  onClose,
}: {
  user: User;
  request: ComponentRequest;
  components: Component[];
  onClose: () => void;
}) {
  const stockOf = (id: string) => components.find((c) => c.id === id)?.quantity ?? 0;
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(request.items.map((i) => [i.componentId, Math.min(i.quantity, stockOf(i.componentId))])),
  );
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const lines = request.items
      .map((i) => ({ componentId: i.componentId, quantity: qty[i.componentId] ?? 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) return setError('Give at least one item, or reject the request instead.');
    const badDate = checkDate(date);
    if (badDate) return setError(badDate);

    setSaving(true);
    setError('');
    try {
      await createDelivery(
        { givenTo: request.userName, date, deliveredBy: nameOf(user), uid: user.uid, note: note.trim() },
        lines,
        {
          id: request.id,
          userId: request.userId,
        },
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not deliver');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-ink-600">
        Delivery date
        <input
          type="date"
          max={today()}
          required
          className={`${field} mt-1`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <p className="pt-1 text-xs text-ink-600">Quantity to give</p>
      {request.items.map((i) => {
        const stock = stockOf(i.componentId);
        return (
          <div key={i.componentId} className="flex items-center gap-3">
            <span className="flex-1 text-sm text-ink-700">
              {i.name}{' '}
              <span className={stock < i.quantity ? 'text-red-600' : 'text-ink-500'}>
                (asked {i.quantity}, {stock} in stock)
              </span>
            </span>
            <input
              type="number"
              min={0}
              max={stock}
              className={`${fieldBase} w-24 shrink-0`}
              value={qty[i.componentId] ?? 0}
              onChange={(e) =>
                setQty({ ...qty, [i.componentId]: Math.min(stock, Math.max(0, Number(e.target.value))) })
              }
              aria-label={`Quantity of ${i.name} to give`}
            />
          </div>
        );
      })}
      <label className="block pt-1 text-xs text-ink-600">
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
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-ghost py-2">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary py-2 disabled:opacity-60">
          {saving ? 'Delivering…' : 'Accept & deliver'}
        </button>
      </div>
    </form>
  );
}

function RejectForm({ user, request, onClose }: { user: User; request: ComponentRequest; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await rejectRequest(request.id, nameOf(user), reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-ink-600">
        Reason (optional)
        <textarea
          autoFocus
          rows={3}
          className={`${field} mt-1 resize-none`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="btn-ghost py-2">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? 'Rejecting…' : 'Reject request'}
        </button>
      </div>
    </form>
  );
}

function RequestCard({
  user,
  request,
  components,
  admin,
}: {
  user: User;
  request: ComponentRequest;
  components: Component[];
  admin: boolean;
}) {
  const [action, setAction] = useState<'accept' | 'reject' | null>(null);
  const close = useCallback(() => setAction(null), []);
  const status = STATUS[request.status];
  const delivered = new Map(request.deliveredItems.map((i) => [i.componentId, i.quantity]));

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink-900">{admin ? request.userName : 'My request'}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {admin && `${request.userEmail} · `}
            {formatTime(request.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.style}`}>{status.label}</span>
      </div>

      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-500">
          <tr>
            <th className="py-1.5 pr-4 font-medium">Item</th>
            <th className="py-1.5 pr-4 text-right font-medium">Asked</th>
            {request.status === 'delivered' && <th className="py-1.5 text-right font-medium">Given</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {request.items.map((i) => (
            <tr key={i.componentId}>
              <td className="py-1.5 pr-4 text-ink-900">{i.name}</td>
              <td className="py-1.5 pr-4 text-right tabular-nums text-ink-700">{i.quantity}</td>
              {request.status === 'delivered' && (
                <td className="py-1.5 text-right tabular-nums text-ink-700">{delivered.get(i.componentId) ?? 0}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {request.note && <p className="mt-3 text-sm text-ink-600">“{request.note}”</p>}
      {request.adminNote && (
        <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink-700">
          <span className="font-medium text-brand-700">Admin note:</span> {request.adminNote}
        </p>
      )}

      {request.status !== 'pending' && (
        <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
          {status.label} by {request.handledBy} · {formatTime(request.handledAt)}
          {request.rejectReason && <span className="mt-1 block text-red-600">Reason: {request.rejectReason}</span>}
        </p>
      )}

      {admin && request.status === 'pending' && (
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setAction('reject')} className="btn-ghost py-2">
            <X className="h-4 w-4" /> Reject
          </button>
          <button onClick={() => setAction('accept')} className="btn-primary py-2">
            <Check className="h-4 w-4" /> Accept & deliver
          </button>
        </div>
      )}

      {action === 'accept' && (
        <Modal title={`Deliver to ${request.userName}`} subtitle={request.userEmail} onClose={close}>
          <AcceptForm user={user} request={request} components={components} onClose={close} />
        </Modal>
      )}
      {action === 'reject' && (
        <Modal title={`Reject request from ${request.userName}`} subtitle={request.userEmail} onClose={close}>
          <RejectForm user={user} request={request} onClose={close} />
        </Modal>
      )}
    </div>
  );
}

// For a user: every item handed to them that has not come back yet.
function NotReturned({ user }: { user: User }) {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [error, setError] = useState('');

  useEffect(
    () =>
      watchMyDeliveries(user.uid, setDeliveries, (e) => {
        console.error(e);
        setError(e.message);
      }),
    [user.uid],
  );

  const rows = (deliveries ?? []).flatMap((d) =>
    d.items
      .filter((i) => i.quantity - i.returned > 0)
      .map((i) => ({ key: `${d.id}-${i.componentId}`, date: d.date, ...i })),
  );
  const total = rows.reduce((n, r) => n + r.quantity - r.returned, 0);

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-ink-900">
        Not returned yet {deliveries && <span className="text-ink-500">({total})</span>}
      </h2>
      {error ? (
        <p className="card text-sm text-red-600">Could not load your items: {error}</p>
      ) : deliveries === null ? (
        <p className="text-sm text-ink-500">Loading your items…</p>
      ) : rows.length === 0 ? (
        <div className="card flex items-center gap-3 py-5 text-ink-600">
          <PackageCheck className="h-6 w-6 text-brand-600" /> You have returned everything. Nothing is pending.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Given on</th>
                <th className="px-4 py-3 text-right font-medium">Given</th>
                <th className="px-4 py-3 text-right font-medium">Returned</th>
                <th className="px-4 py-3 text-right font-medium">To return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-3 font-medium text-ink-900">{r.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-700">{r.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-700">{r.returned}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand-600">
                    {r.quantity - r.returned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const FILTERS = ['pending', 'all'] as const;

export default function RequestsPage({
  user,
  components,
  admin,
}: {
  user: User;
  components: Component[];
  admin: boolean;
}) {
  const [requests, setRequests] = useState<ComponentRequest[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');

  useEffect(() => {
    const onError = (e: Error) => {
      console.error(e);
      setError(e.message);
    };
    return admin ? watchAllRequests(setRequests, onError) : watchMyRequests(user.uid, setRequests, onError);
  }, [admin, user.uid]);

  const shown = (requests ?? []).filter((r) => !admin || filter === 'all' || r.status === 'pending');
  const pending = (requests ?? []).filter((r) => r.status === 'pending').length;

  return (
    <>
      {!admin && <NotReturned user={user} />}
      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-ink-900">
          {admin ? 'Requests' : 'My requests'}{' '}
          {requests && <span className="text-ink-500">({admin ? `${pending} pending` : requests.length})</span>}
        </h2>
        {admin ? (
          <div className="flex gap-1 rounded-full border border-ink-200 bg-ink-50 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                  filter === f ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        ) : (
          !adding && (
            <button onClick={() => setAdding(true)} className="btn-primary py-2">
              <Plus className="h-4 w-4" /> New request
            </button>
          )
        )}
      </div>

      {adding && <NewRequestForm user={user} components={components} onClose={() => setAdding(false)} />}

      {error ? (
        <p className="card text-sm text-red-600">Could not load requests: {error}</p>
      ) : requests === null ? (
        <p className="text-sm text-ink-500">Loading requests…</p>
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <ClipboardList className="h-10 w-10 text-ink-300" />
          <p className="mt-3 text-ink-600">
            {admin
              ? filter === 'pending'
                ? 'No pending requests.'
                : 'No requests yet.'
              : 'You have not requested anything yet. Click New request to ask for components.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((r) => (
            <RequestCard key={r.id} user={user} request={r} components={components} admin={admin} />
          ))}
        </div>
      )}
    </>
  );
}
