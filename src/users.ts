import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
