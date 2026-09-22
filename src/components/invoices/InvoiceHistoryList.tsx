import React from 'react';
import { Download, FileText, Plus } from 'lucide-react';
import { Invoice, InvoiceSourceType } from '@/types';
import { useInvoices } from '@/hooks/useInvoices';
import { calculateInvoiceTotals, formatEuro, formatInvoiceDate } from '@/lib/invoiceLogic';
import { downloadInvoicePdf } from '@/lib/invoicePdf';

export default function InvoiceHistoryList({
  sourceType,
  sourceId,
  onOpen,
  onCreate,
}: {
  sourceType: InvoiceSourceType;
  sourceId: string;
  onOpen: (invoice: Invoice) => void;
  onCreate: () => void;
}) {
  const { invoices, loading } = useInvoices(sourceType, sourceId);

  return (
    <div className="space-y-2 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Invoices</h4>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> New invoice
        </button>
      </div>
      {loading && invoices.length === 0 && (
        <p className="text-[11px] text-gray-400">Loading invoices…</p>
      )}
      {!loading && invoices.length === 0 && (
        <p className="text-[11px] text-gray-500">No invoices yet.</p>
      )}
      <ul className="space-y-1.5">
        {invoices.map(inv => {
          const totals = calculateInvoiceTotals(inv);
          return (
            <li key={inv.id}>
              <div className="flex items-center gap-2 bg-white/70 border border-slate-200 rounded-xl px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpen(inv)}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                    <FileText size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{inv.invoiceNumber}</span>
                  </span>
                  <span className="block text-[11px] text-gray-500 truncate">
                    {formatEuro(totals.total)} · {totals.status} · {formatInvoiceDate(inv.invoiceDate)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadInvoicePdf(inv)}
                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg"
                  aria-label="Download PDF"
                >
                  <Download size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
