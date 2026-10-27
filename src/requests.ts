import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Query,
} from 'firebase/firestore';
import { db } from './firebase';

export type RequestItem = { componentId: string; name: string; quantity: number };

export type RequestStatus = 'pending' | 'delivered' | 'rejected';

export type ComponentRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: RequestItem[];
  deliveredItems: RequestItem[];
  note: string;
  adminNote: string;
  status: RequestStatus;
  createdAt: Date | null;
  handledBy: string;
  handledAt: Date | null;
  rejectReason: string;
};

const requestsRef = collection(db, 'requests');

const timeOf = (r: ComponentRequest) => r.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

function watch(q: Query, onData: (items: ComponentRequest[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: data.userId ?? '',
              userName: data.userName ?? '',
              userEmail: data.userEmail ?? '',
              items: data.items ?? [],
              deliveredItems: data.deliveredItems ?? [],
              note: data.note ?? '',
              adminNote: data.adminNote ?? '',
              status: data.status ?? 'pending',
              createdAt: data.createdAt?.toDate() ?? null,
              handledBy: data.handledBy ?? '',
              handledAt: data.handledAt?.toDate() ?? null,
              rejectReason: data.rejectReason ?? '',
            };
          })
          // Newest first; a request still being written has no server time yet, so it sorts on top.
          .sort((a, b) => timeOf(b) - timeOf(a)),
      ),
    onError,
  );
}

// Every request, for the admin.
export const watchAllRequests = (onData: (items: ComponentRequest[]) => void, onError: (e: Error) => void) =>
  watch(query(requestsRef, orderBy('createdAt', 'desc')), onData, onError);

// Only the given user's requests. Sorted on the client so no composite index is needed.
export const watchMyRequests = (
  uid: string,
  onData: (items: ComponentRequest[]) => void,
  onError: (e: Error) => void,
) => watch(query(requestsRef, where('userId', '==', uid)), onData, onError);

export function sendRequest(user: { uid: string; name: string; email: string }, items: RequestItem[], note: string) {
  return addDoc(requestsRef, {
    userId: user.uid,
    userName: user.name,
    userEmail: user.email,
    items,
    note,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export function rejectRequest(id: string, by: string, reason: string) {
  return updateDoc(doc(requestsRef, id), {
    status: 'rejected',
    rejectReason: reason,
    handledBy: by,
    handledAt: serverTimestamp(),
  });
}
