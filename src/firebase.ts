import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCmPbVIMcr5lKOSCqekjqw8qoAJOItUlC4',
  authDomain: 'inventry-cfd31.firebaseapp.com',
  projectId: 'inventry-cfd31',
  storageBucket: 'inventry-cfd31.firebasestorage.app',
  messagingSenderId: '630225391442',
  appId: '1:630225391442:web:7d759f12d8dc1dbd96348b',
  measurementId: 'G-VF93VQYLGS',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// The project's Firestore database was created with the ID "default", not the usual "(default)".
export const db = getFirestore(app, 'default');
export const googleProvider = new GoogleAuthProvider();
// hd only pre-filters Google's account chooser; the real check is isAllowed() and the Firestore rules.
googleProvider.setCustomParameters({ prompt: 'select_account', hd: 'atumx.in' });

// Analytics is unavailable in some browsers/environments, so only start it when supported.
isSupported().then((ok) => {
  if (ok) getAnalytics(app);
});
