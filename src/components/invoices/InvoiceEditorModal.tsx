import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Download, Plus, RefreshCw, Save, X } from 'lucide-react';
import { db } from '@/services/firebase';
import { Invoice, InvoiceDiscount, InvoiceItem } from '@/types';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import CurrencyInput from '@/components/ui/CurrencyInput';
import InvoicePreview from '@/components/invoices/InvoicePreview';
import { setLastInvoiceBankDetails, setLastInvoicePaymentMethod, getLastInvoiceBankDetails } from '@/lib/invoiceDetails';
import {
  InvoiceSourceSnapshot,
  applySnapshotToInvoice,
  calculateInvoiceTotals,
  createInvoiceDraft,
  formatEuro,
  invoiceToFirestore,
  newInvoiceId,
} from '@/lib/invoiceLogic';
import { allocateInvoiceNumberOnce, invoiceDateKey, todayInvoiceDateIso } from '@/lib/invoiceNumber';
import { downloadInvoicePdf } from '@/lib/invoicePdf';
import { cn } from '@/lib/utils';

const FIELD = 'w-full border border-slate-200 rounded-xl bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1';

function newDocId(): string {
  return crypto.randomUUID();
}

function firestoreMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/permission/i.test(text)) {
    return 'Saving invoices is blocked by Firestore rules. Deploy firestore.rules (invoices and invoiceCounters), then click Invoice again.';
  }
  return 'Could not save the invoice. You can still edit and generate a PDF locally.';
}

function DiscountEditor({
  discount,
  onChange,
}: {
  discount?: InvoiceDiscount | null;
  onChange: (next: InvoiceDiscount | null) => void;
}) {
  const active = discount && (discount.value > 0 || discount.kind);
  if (!active) {
    return (
      <button
        type="button"
        onClick={() => onChange({ kind: 'amount', value: 0 })}
        className="text-xs font-bold text-blue-600 hover:text-blue-700"
      >
        Add discount
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={discount!.kind}
        onChange={e => onChange({ ...discount!, kind: e.target.value as InvoiceDiscount['kind'] })}
        className="border border-slate-200 rounded-lg text-xs px-1.5 py-2 bg-white"
      >
        <option value="amount">€</option>
        <option value="percent">%</option>
      </select>
      <div className="relative w-24">
        <CurrencyInput
          value={discount!.value || 0}
          onChange={v => onChange({ ...discount!, value: v })}
          className="pl-2 pr-2 py-2 border border-slate-200 rounded-lg text-xs"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="text-xs font-bold text-rose-500 hover:text-rose-600 px-1"
      >
        Remove
      </button>
    </div>
  );
}

interface InvoiceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: InvoiceSourceSnapshot;
  existing?: Invoice | null;
  createNew?: boolean;
}

function buildInvoiceState(
  snapshot: InvoiceSourceSnapshot,
  existing: Invoice | null,
  createNew: boolean,
): Invoice {
  if (existing && !createNew) {
    return {
      ...existing,
      items: existing.items || [],
      payments: existing.payments || [],
      paymentMethod: existing.paymentMethod || '',
      paymentDetails: existing.paymentDetails || getLastInvoiceBankDetails(),
    };
  }
  try {
    return {
      ...createInvoiceDraft(snapshot, `PM-${invoiceDateKey()}-…`, todayInvoiceDateIso()),
      id: newDocId(),
    };
  } catch {
    const now = new Date().toISOString();
    return {
      id: newDocId(),
      invoiceNumber: `PM-${invoiceDateKey()}-…`,
      invoiceDate: todayInvoiceDateIso(),
      sourceType: snapshot.sourceType,
      sourceId: snapshot.sourceId,
      guestName: snapshot.guestName || '',
      guestEmail: snapshot.guestEmail || '',
      description: '',
      items: [],
      invoiceDiscount: null,
      payments: [],
      paymentMethod: '',
      paymentDetails: getLastInvoiceBankDetails(),
      createdAt: now,
      updatedAt: now,
    };
  }
}

export default function InvoiceEditorModal({
  isOpen,
  onClose,
  snapshot,
  existing = null,
  createNew = false,
}: InvoiceEditorModalProps) {
  const [invoice, setInvoice] = useState<Invoice>(() => buildInvoiceState(snapshot, existing, createNew));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || (existing && !createNew)) return;
    const docId = invoice.id;
    let cancelled = false;
    (async () => {
      const number = await allocateInvoiceNumberOnce(docId);
      await setDoc(doc(db, 'invoices', docId), invoiceToFirestore({ ...invoice, invoiceNumber: number }));
      if (cancelled) return;
      setInvoice(prev => ({ ...prev, invoiceNumber: number }));
      setError(null);
    })().catch((err) => {
      if (!cancelled) setError(firestoreMessage(err));
    });
    return () => {
      cancelled = true;
    };
    // Create exactly once when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const totals = useMemo(() => calculateInvoiceTotals(invoice), [invoice]);
  const invoiceRef = useRef(invoice);
  invoiceRef.current = invoice;
  const skipAutosave = useRef(true);

  const persist = async (next: Invoice, extra?: Partial<Invoice>) => {
    if (!next.id) return next;
    const merged = { ...next, ...extra, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'invoices', next.id), invoiceToFirestore(merged), { merge: true });
    return merged;
  };

  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      persist(invoice).catch(() => {});
    }, 700);
    return () => window.clearTimeout(timer);
  }, [invoice]);

  const closeAndSave = () => {
    persist(invoiceRef.current).catch(() => {});
    onClose();
  };

  const patch = (partial: Partial<Invoice>) => {
    setInvoice(prev => ({ ...prev, ...partial }));
    if (partial.paymentMethod != null) {
      setLastInvoicePaymentMethod(partial.paymentMethod);
    }
    if (partial.paymentDetails != null) {
      setLastInvoiceBankDetails(partial.paymentDetails);
    }
  };

  const updateItem = (index: number, partial: Partial<InvoiceItem>) => {
    setInvoice(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], ...partial };
      return { ...prev, items };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await persist(invoice);
      setInvoice(saved);
      setStatus('Saved');
    } catch (err) {
      setError(firestoreMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFromBooking = () => {
    setInvoice(prev => applySnapshotToInvoice(prev, snapshot, { keepInvoiceDiscount: true }));
    setStatus('Updated from booking');
  };

  const handleGeneratePdf = async () => {
    setSaving(true);
    setError(null);
    const withPdf = { ...invoice, pdfGeneratedAt: new Date().toISOString() };
    setLastInvoicePaymentMethod(withPdf.paymentMethod || '');
    setLastInvoiceBankDetails(withPdf.paymentDetails || '');
    try {
      const saved = await persist(withPdf);
      setInvoice(saved);
    } catch (err) {
      setError(firestoreMessage(err));
      setInvoice(withPdf);
    }
    try {
      downloadInvoicePdf(withPdf);
      setStatus('PDF downloaded');
    } catch {
      setError('Could not generate PDF.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeAndSave}
      title={invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : 'Create Invoice'}
      elevated
      wide
      footer={
          <div className="flex flex-wrap items-center gap-2">
            {error && <p className="w-full text-xs font-bold text-rose-700">{error}</p>}
            {status && !error && <p className="text-xs font-bold text-emerald-700 mr-auto">{status}</p>}
            <button
              type="button"
              onClick={handleUpdateFromBooking}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
            >
              <RefreshCw size={14} /> Update from {snapshot.sourceType === 'venueHire' ? 'venue hire' : 'booking'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-xl disabled:opacity-50"
            >
              <Save size={14} /> Save
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-black rounded-xl hover:bg-gray-800 disabled:opacity-50"
            >
              <Download size={14} /> Generate PDF
            </button>
          </div>
      }
    >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 -mx-1">
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Invoice date</label>
                <DatePicker
                  value={invoice.invoiceDate}
                  onChange={v => patch({ invoiceDate: v })}
                />
              </div>
              <div>
                <label className={LABEL}>Invoice number</label>
                <div className={cn(FIELD, 'bg-gray-50 text-gray-500')}>{invoice.invoiceNumber}</div>
              </div>
            </div>

            <div>
              <label className={LABEL}>Guest name</label>
              <input className={FIELD} value={invoice.guestName} onChange={e => patch({ guestName: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Guest email</label>
              <input className={FIELD} value={invoice.guestEmail} onChange={e => patch({ guestEmail: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Description</label>
              <textarea
                className={cn(FIELD, 'min-h-[72px] resize-y')}
                value={invoice.description}
                onChange={e => patch({ description: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={cn(LABEL, 'mb-0')}>Items</h3>
                <button
                  type="button"
                  onClick={() => patch({
                    items: [...invoice.items, {
                      id: newInvoiceId('item'),
                      description: '',
                      quantity: 1,
                      unitPrice: 0,
                      discount: null,
                    }],
                  })}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600"
                >
                  <Plus size={12} /> Add item
                </button>
              </div>
              <div className="space-y-3">
                {invoice.items.map((item, index) => (
                  <div key={item.id} className="border border-slate-200 rounded-2xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        className={cn(FIELD, 'flex-1')}
                        placeholder="Item description"
                        value={item.description}
                        onChange={e => updateItem(index, { description: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => patch({ items: invoice.items.filter((_, i) => i !== index) })}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                        aria-label="Remove item"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={LABEL}>Quantity</label>
                        <CurrencyInput
                          value={item.quantity}
                          onChange={v => updateItem(index, { quantity: v })}
                          className={cn(FIELD, 'py-2')}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">€</span>
                          <CurrencyInput
                            value={item.unitPrice}
                            onChange={v => updateItem(index, { unitPrice: v })}
                            className={cn(FIELD, 'pl-8 py-2')}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>Item discount</label>
                      <DiscountEditor
                        discount={item.discount}
                        onChange={d => updateItem(index, { discount: d })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-3">
              <label className={LABEL}>Invoice discount (optional, on subtotal)</label>
              <DiscountEditor
                discount={invoice.invoiceDiscount}
                onChange={d => patch({ invoiceDiscount: d })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={cn(LABEL, 'mb-0')}>Payments already received</h3>
                <button
                  type="button"
                  onClick={() => patch({
                    payments: [...invoice.payments, { id: newInvoiceId('pay'), label: `Payment ${invoice.payments.length + 1}`, amount: 0 }],
                  })}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600"
                >
                  <Plus size={12} /> Add payment
                </button>
              </div>
              <div className="space-y-2">
                {invoice.payments.map((payment, index) => (
                  <div key={payment.id} className="flex items-center gap-2">
                    <input
                      className={cn(FIELD, 'flex-1')}
                      value={payment.label}
                      onChange={e => {
                        const payments = [...invoice.payments];
                        payments[index] = { ...payment, label: e.target.value };
                        patch({ payments });
                      }}
                    />
                    <div className="relative w-32">
                      <span className="absolute left-3 top-2.5 text-gray-400 text-sm">€</span>
                      <CurrencyInput
                        value={payment.amount}
                        onChange={v => {
                          const payments = [...invoice.payments];
                          payments[index] = { ...payment, amount: v };
                          patch({ payments });
                        }}
                        className={cn(FIELD, 'pl-8')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => patch({ payments: invoice.payments.filter((_, i) => i !== index) })}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL}>Payment method</label>
              <input
                className={FIELD}
                placeholder="Bank Transfer"
                value={invoice.paymentMethod}
                onChange={e => patch({ paymentMethod: e.target.value })}
              />
              <p className="text-[11px] text-gray-400 mt-1">Remembered for the next invoice you create.</p>
            </div>

            <div>
              <label className={LABEL}>Payment details</label>
              <textarea
                className={cn(FIELD, 'min-h-[140px] resize-y font-mono text-[13px] leading-relaxed')}
                value={invoice.paymentDetails || ''}
                onChange={e => patch({ paymentDetails: e.target.value })}
              />
              <p className="text-[11px] text-gray-400 mt-1">Shown at the bottom of the invoice. Remembered for the next invoice you create.</p>
            </div>

            {totals && (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatEuro(totals.subtotal)}</span></div>
                {totals.invoiceDiscountAmount > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Invoice discount</span><span>−{formatEuro(totals.invoiceDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold"><span>Total</span><span>{formatEuro(totals.total)}</span></div>
                <div className="flex justify-between"><span>Paid</span><span>{formatEuro(totals.paid)}</span></div>
                <div className="flex justify-between"><span>Remaining</span><span>{formatEuro(totals.remaining)}</span></div>
                <div className="text-right font-bold text-xs tracking-wide">{totals.status}</div>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className={LABEL}>Live preview</p>
            <div className="bg-gray-100 rounded-2xl p-3 overflow-auto max-h-[70vh]">
              <div className="origin-top scale-[0.72] sm:scale-90 lg:scale-[0.82] xl:scale-90">
                <InvoicePreview invoice={invoice} />
              </div>
            </div>
          </div>
        </div>
    </Modal>
  );
}
