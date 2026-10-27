import { useEffect, type ReactNode } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Component } from './inventory';
import { emptyLine, fieldBase, type Line } from './lines';

// Rows of "pick an in-stock component + quantity", with add/remove row controls.
export function ItemPicker({
  components,
  lines,
  onChange,
}: {
  components: Component[];
  lines: Line[];
  onChange: (lines: Line[]) => void;
}) {
  const available = components.filter((c) => c.quantity > 0);
  const stockOf = (id: string) => components.find((c) => c.id === id)?.quantity ?? 0;
  const setLine = (i: number, patch: Partial<Line>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-600">Items</p>
      {lines.map((line, i) => {
        const taken = new Set(lines.filter((_, j) => j !== i).map((l) => l.componentId));
        const max = stockOf(line.componentId);
        return (
          <div key={i} className="flex gap-2">
            <select
              className={`${fieldBase} min-w-0 flex-1`}
              value={line.componentId}
              onChange={(e) => setLine(i, { componentId: e.target.value, quantity: 1 })}
            >
              <option value="" className="bg-white text-ink-600">
                Select an item…
              </option>
              {available
                .filter((c) => !taken.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id} className="bg-white text-ink-900">
                    {c.name} ({c.quantity} in stock)
                  </option>
                ))}
            </select>
            <input
              type="number"
              min={1}
              max={max || undefined}
              disabled={!line.componentId}
              className={`${fieldBase} w-20 shrink-0 sm:w-24 disabled:opacity-50`}
              value={line.quantity}
              onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
              aria-label="Quantity"
            />
            <button
              type="button"
              onClick={() => onChange(lines.length > 1 ? lines.filter((_, j) => j !== i) : [emptyLine()])}
              className="grid w-10 shrink-0 place-items-center rounded-xl border border-ink-200 text-ink-500 hover:text-red-600"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      {lines.length < available.length && (
        <button
          type="button"
          onClick={() => onChange([...lines, emptyLine()])}
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
        >
          <Plus className="h-4 w-4" /> Add another item
        </button>
      )}
      {available.length === 0 && <p className="text-sm text-ink-500">No items are in stock.</p>}
    </div>
  );
}

// A centered popup over a dimmed backdrop; closes on Escape or a click outside the panel.
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card max-h-[90dvh] w-full max-w-md overflow-y-auto bg-white"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 break-all text-xs text-ink-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
