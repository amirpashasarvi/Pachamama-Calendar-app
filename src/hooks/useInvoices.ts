import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Invoice, InvoiceSourceType } from '@/types';

export function useInvoices(sourceType: InvoiceSourceType | null, sourceId: string | null) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(!!sourceId);

  useEffect(() => {
    if (!sourceType || !sourceId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'invoices'), where('sourceId', '==', sourceId));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as Invoice))
        .filter(inv => inv.sourceType === sourceType)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      setInvoices(rows);
      setLoading(false);
    }, () => {
      setLoading(false);
    });
    return unsub;
  }, [sourceType, sourceId]);

  return { invoices, loading };
}
