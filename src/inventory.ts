import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type Component = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  date: string;
  givenBy: string;
};

export type NewComponent = Omit<Component, 'id'>;

const componentsRef = collection(db, 'components');

// Streams the components collection, sorted by name, and returns the unsubscribe function.
export function watchComponents(
  onData: (items: Component[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    query(componentsRef, orderBy('name')),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name ?? '',
            category: data.category ?? '',
            quantity: Number(data.quantity ?? 0),
            date: data.date ?? '',
            givenBy: data.givenBy ?? '',
          };
        }),
      ),
    onError,
  );
}

export function addComponent(item: NewComponent, uid: string) {
  return addDoc(componentsRef, { ...item, createdBy: uid, createdAt: serverTimestamp() });
}
