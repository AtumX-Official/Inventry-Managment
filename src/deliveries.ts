import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Query,
  type Transaction,
} from 'firebase/firestore';
import { db } from './firebase';

export type DeliveryItem = {
  componentId: string;
  name: string;
  quantity: number;
  returned: number;
};

export type ReturnEntry = {
  date: string;
  by: string;
  items: { componentId: string; name: string; quantity: number }[];
};

export type Delivery = {
  id: string;
  // Set when the delivery fulfilled a member's request; empty for manual deliveries.
  userId: string;
  givenTo: string;
  date: string;
  deliveredBy: string;
  note: string;
  items: DeliveryItem[];
  returns: ReturnEntry[];
};

export type Status = 'Delivered' | 'Partly returned' | 'Returned';

export function statusOf(d: Delivery): Status {
  const out = d.items.reduce((n, i) => n + i.quantity - i.returned, 0);
  if (out === 0) return 'Returned';
  return d.items.some((i) => i.returned > 0) ? 'Partly returned' : 'Delivered';
}

const deliveriesRef = collection(db, 'deliveries');

function watch(q: Query, onData: (items: Delivery[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId ?? '',
            givenTo: data.givenTo ?? '',
            date: data.date ?? '',
            deliveredBy: data.deliveredBy ?? '',
            note: data.note ?? '',
            items: data.items ?? [],
            returns: data.returns ?? [],
          };
        }),
      ),
    onError,
  );
}

// Streams every delivery, newest first, and returns the unsubscribe function.
export const watchDeliveries = (onData: (items: Delivery[]) => void, onError: (e: Error) => void) =>
  watch(query(deliveriesRef, orderBy('createdAt', 'desc')), onData, onError);

// Streams the deliveries made to one user from their requests, newest first.
// Sorted on the client so no composite index is needed.
export const watchMyDeliveries = (uid: string, onData: (items: Delivery[]) => void, onError: (e: Error) => void) =>
  watch(
    query(deliveriesRef, where('userId', '==', uid)),
    (items) => onData(items.sort((a, b) => b.date.localeCompare(a.date))),
    onError,
  );

// Reads the current stock of each component inside a transaction, failing if one was deleted.
async function readStock(tx: Transaction, ids: string[]) {
  const stock = new Map<string, { name: string; quantity: number }>();
  for (const id of ids) {
    const snap = await tx.get(doc(db, 'components', id));
    if (!snap.exists()) throw new Error('A selected component no longer exists.');
    stock.set(id, { name: snap.data().name ?? '', quantity: Number(snap.data().quantity ?? 0) });
  }
  return stock;
}

// Records a delivery and takes the delivered quantities out of stock, all or nothing.
// When it fulfils a user's request, that request is marked delivered in the same transaction.
export function createDelivery(
  input: { givenTo: string; date: string; deliveredBy: string; uid: string; note?: string },
  lines: { componentId: string; quantity: number }[],
  request?: { id: string; userId: string },
) {
  return runTransaction(db, async (tx) => {
    const requestRef = request && doc(db, 'requests', request.id);
    if (requestRef) {
      const snap = await tx.get(requestRef);
      if (snap.data()?.status !== 'pending') throw new Error('This request was already handled.');
    }
    const stock = await readStock(
      tx,
      lines.map((l) => l.componentId),
    );
    for (const l of lines) {
      const s = stock.get(l.componentId)!;
      if (l.quantity > s.quantity) {
        throw new Error(`Only ${s.quantity} of ${s.name} left in stock.`);
      }
    }
    for (const l of lines) {
      const s = stock.get(l.componentId)!;
      tx.update(doc(db, 'components', l.componentId), { quantity: s.quantity - l.quantity });
    }
    const deliveryRef = doc(deliveriesRef);
    if (requestRef) {
      tx.update(requestRef, {
        status: 'delivered',
        deliveryId: deliveryRef.id,
        deliveredItems: lines.map((l) => ({
          componentId: l.componentId,
          name: stock.get(l.componentId)!.name,
          quantity: l.quantity,
        })),
        adminNote: input.note ?? '',
        handledBy: input.deliveredBy,
        handledAt: serverTimestamp(),
      });
    }
    tx.set(deliveryRef, {
      ...(request ? { requestId: request.id, userId: request.userId } : {}),
      givenTo: input.givenTo,
      date: input.date,
      deliveredBy: input.deliveredBy,
      note: input.note ?? '',
      createdBy: input.uid,
      createdAt: serverTimestamp(),
      items: lines.map((l) => ({
        componentId: l.componentId,
        name: stock.get(l.componentId)!.name,
        quantity: l.quantity,
        returned: 0,
      })),
      returns: [],
    });
  });
}

// Records items coming back from a delivery and adds them back into stock, all or nothing.
export function returnItems(
  deliveryId: string,
  entry: { date: string; by: string },
  lines: { componentId: string; quantity: number }[],
) {
  return runTransaction(db, async (tx) => {
    const ref = doc(deliveriesRef, deliveryId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This delivery no longer exists.');
    const items: DeliveryItem[] = snap.data().items ?? [];
    const returns: ReturnEntry[] = snap.data().returns ?? [];
    const stock = await readStock(
      tx,
      lines.map((l) => l.componentId),
    );

    for (const l of lines) {
      const item = items.find((i) => i.componentId === l.componentId);
      if (!item || l.quantity > item.quantity - item.returned) {
        throw new Error(`Cannot return more ${item?.name ?? 'items'} than are still out.`);
      }
      item.returned += l.quantity;
    }
    for (const l of lines) {
      const s = stock.get(l.componentId)!;
      tx.update(doc(db, 'components', l.componentId), { quantity: s.quantity + l.quantity });
    }
    tx.update(ref, {
      items,
      returns: [
        ...returns,
        {
          ...entry,
          items: lines.map((l) => ({
            componentId: l.componentId,
            name: items.find((i) => i.componentId === l.componentId)!.name,
            quantity: l.quantity,
          })),
        },
      ],
    });
  });
}
