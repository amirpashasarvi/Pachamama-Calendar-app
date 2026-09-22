import { format } from 'date-fns';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';

export function invoiceDateKey(date = new Date()): string {
  return format(date, 'ddMMyy');
}

export function todayInvoiceDateIso(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

const allocateCache = new Map<string, Promise<string>>();

/** PM-DDMMYY-n — n is the nth invoice created on that calendar date. */
export async function allocateInvoiceNumber(createdAt = new Date()): Promise<string> {
  const key = invoiceDateKey(createdAt);
  const ref = doc(db, 'invoiceCounters', key);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.exists() ? Number(snap.data()?.count) : 0) || 0) + 1;
    tx.set(ref, {
      count: next,
      dateKey: key,
      updatedAt: new Date().toISOString(),
    });
    return next;
  });
  return `PM-${key}-${seq}`;
}

export function allocateInvoiceNumberOnce(sessionId: string, createdAt = new Date()): Promise<string> {
  const cached = allocateCache.get(sessionId);
  if (cached) return cached;
  const pending = allocateInvoiceNumber(createdAt).catch((err) => {
    allocateCache.delete(sessionId);
    throw err;
  });
  allocateCache.set(sessionId, pending);
  return pending;
}
