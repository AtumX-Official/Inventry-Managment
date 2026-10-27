import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAdditionalUserInfo, type UserCredential } from 'firebase/auth';
import { db } from './firebase';

// Saves the signed-in user's full details to Firestore at users/{uid}.
export async function saveUser(cred: UserCredential) {
  const { user } = cred;
  const info = getAdditionalUserInfo(cred);
  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref);

  await setDoc(
    ref,
    {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      photoURL: user.photoURL,
      phoneNumber: user.phoneNumber,
      providerId: info?.providerId ?? null,
      googleProfile: info?.profile ?? null,
      providerData: user.providerData.map((p) => ({
        providerId: p.providerId,
        uid: p.uid,
        displayName: p.displayName,
        email: p.email,
        photoURL: p.photoURL,
        phoneNumber: p.phoneNumber,
      })),
      accountCreatedAt: user.metadata.creationTime ?? null,
      lastSignInTime: user.metadata.lastSignInTime ?? null,
      lastLoginAt: serverTimestamp(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export type Member = {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  lastLoginAt: Date | null;
  firstLoginAt: Date | null;
  emailVerified: boolean;
  phoneNumber: string;
  // Browser user agent and language from the most recent login.
  userAgent: string;
  language: string;
};

// Streams everyone who has signed in (admin only, per the Firestore rules).
export function watchUsers(onData: (items: Member[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            name: data.displayName ?? data.email ?? 'Unknown',
            email: data.email ?? '',
            photoURL: data.photoURL ?? '',
            lastLoginAt: data.lastLoginAt?.toDate() ?? null,
            firstLoginAt: data.createdAt?.toDate() ?? null,
            emailVerified: Boolean(data.emailVerified),
            phoneNumber: data.phoneNumber ?? '',
            userAgent: data.userAgent ?? '',
            language: data.language ?? '',
          };
        }),
      ),
    onError,
  );
}
