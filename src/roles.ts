import type { User } from 'firebase/auth';

// The only account allowed to manage inventory. Firestore rules enforce the same check.
export const ADMIN_EMAIL = 'info@atumx.in';

export const isAdmin = (user: User) => user.email === ADMIN_EMAIL && user.emailVerified;

// Only company Google accounts may use the app. Firestore rules enforce the same check.
export const ALLOWED_DOMAIN = 'atumx.in';

export const isAllowed = (user: User) =>
  user.emailVerified && (user.email ?? '').toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
