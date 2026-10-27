import type { User } from 'firebase/auth';
import type { Component } from './inventory';

// Input styling without a width, for inputs that size themselves inside a flex row.
export const fieldBase =
  'rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-base text-ink-900 outline-none sm:text-sm focus:border-brand-500';

export const field = `${fieldBase} w-full`;

export const nameOf = (user: User) => user.displayName ?? user.email ?? 'Unknown';

export type Line = { componentId: string; quantity: number };

export const emptyLine = (): Line => ({ componentId: '', quantity: 1 });

// Returns an error message if any chosen line is missing or exceeds stock, else ''.
export function checkLines(lines: Line[], components: Component[]) {
  const chosen = lines.filter((l) => l.componentId);
  if (chosen.length === 0) return 'Select at least one item.';
  const stockOf = (id: string) => components.find((c) => c.id === id)?.quantity ?? 0;
  if (chosen.some((l) => l.quantity < 1 || l.quantity > stockOf(l.componentId))) {
    return 'Each quantity must be between 1 and the stock available.';
  }
  return '';
}
