// Today's date as YYYY-MM-DD in local time, the format a date input expects.
export const today = () => new Date().toLocaleDateString('en-CA');

// Returns an error message if a YYYY-MM-DD date is after today (or before `min`), else ''.
export function checkDate(d: string, min?: string) {
  if (!d) return 'Choose a date.';
  if (d > today()) return 'Date cannot be in the future.';
  if (min && d < min) return `Date cannot be before ${formatDate(min)}.`;
  return '';
}

export const formatDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
