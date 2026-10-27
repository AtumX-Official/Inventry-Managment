// Today's date as YYYY-MM-DD in local time, the format a date input expects.
export const today = () => new Date().toLocaleDateString('en-CA');

// Returns an error message if a YYYY-MM-DD date is after today (or before `min`), else ''.
export function checkDate(d: string, min?: string) {
  if (!d) return 'Choose a date.';
  if (d > today()) return 'Date cannot be in the future.';
  if (min && d < min) return `Date cannot be before ${formatDate(min)}.`;
  return '';
}

// Heading for a day's group: "Today", "Yesterday", or the formatted date.
export function dayLabel(d: string) {
  if (d === today()) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d === y.toLocaleDateString('en-CA')) return 'Yesterday';
  return formatDate(d) || 'No date';
}

export const formatDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
