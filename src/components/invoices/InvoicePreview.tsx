import React from 'react';
import { Invoice } from '@/types';
import { INVOICE_ISSUER, defaultInvoiceBankDetails } from '@/lib/invoiceDetails';
import {
  calculateInvoiceTotals,
  formatDiscountDisplay,
  formatEuro,
  formatInvoiceDate,
  lineDiscountAmount,
} from '@/lib/invoiceLogic';
import { cn } from '@/lib/utils';

export default function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const totals = calculateInvoiceTotals(invoice);
  const statusClass =
    totals.status === 'PAID'
      ? 'text-emerald-700'
      : totals.status === 'PARTIALLY PAID'
        ? 'text-amber-700'
        : 'text-rose-700';

  return (
    <div className="bg-white text-gray-900 mx-auto w-full max-w-[210mm] min-h-[280mm] shadow-sm border border-gray-100 p-8 sm:p-10 text-[13px] leading-snug">
      <h1 className="text-[28px] font-bold tracking-tight">INVOICE</h1>
      <p className="text-gray-400 mt-1">{invoice.invoiceNumber}</p>
      <p className="text-gray-400">{formatInvoiceDate(invoice.invoiceDate)}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-10">
        <div>
          <p className="font-semibold">{INVOICE_ISSUER.title}</p>
          <p className="text-gray-600">{INVOICE_ISSUER.name}</p>
          {INVOICE_ISSUER.addressLines.map(line => (
            <p key={line} className="text-gray-600">{line}</p>
          ))}
          <p className="text-blue-600 mt-1">{INVOICE_ISSUER.email}</p>
        </div>
        <div>
          <p className="font-medium">{invoice.guestName || '—'}</p>
          {invoice.guestEmail ? <p className="text-gray-600">{invoice.guestEmail}</p> : null}
          {invoice.guestPhone ? <p className="text-gray-600">{invoice.guestPhone}</p> : null}
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-gray-50 px-5 py-4">
        <p className="font-semibold mb-1">Description</p>
        <p className="text-gray-600 whitespace-pre-wrap">{invoice.description || '—'}</p>
      </div>

      <div className="mt-8">
        <p className="font-semibold mb-3">Items</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
                <th className="font-medium px-3 py-2 rounded-l-lg">Item</th>
                <th className="font-medium px-3 py-2 text-right">Quantity</th>
                <th className="font-medium px-3 py-2 text-right">Price</th>
                <th className="font-medium px-3 py-2 text-right">Discount</th>
                <th className="font-medium px-3 py-2 text-right rounded-r-lg">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item, index) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-3 py-3 align-top">{item.description || '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatEuro(item.unitPrice)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-500">
                    {formatDiscountDisplay(lineDiscountAmount(item))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatEuro(totals.itemTotals[index] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 rounded-xl bg-gray-50 px-4 py-3 flex items-center justify-between font-semibold">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatEuro(totals.subtotal)}</span>
        </div>
        {totals.invoiceDiscountAmount > 0 && (
          <div className="px-4 py-2 flex items-center justify-between text-rose-700">
            <span>Invoice discount</span>
            <span className="tabular-nums">−{formatEuro(totals.invoiceDiscountAmount)}</span>
          </div>
        )}
        <div className="mt-4 ml-auto w-full sm:w-80">
          <div className="border-t border-gray-200 pt-3 flex items-center justify-between font-semibold">
            <span>Invoice Total</span>
            <span className="tabular-nums">{formatEuro(totals.total)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-gray-600">
            <span>Paid</span>
            <span className="tabular-nums">{formatEuro(totals.paid)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-gray-600">
            <span>Remaining</span>
            <span className="tabular-nums">{formatEuro(totals.remaining)}</span>
          </div>
          <div className="mt-2 flex items-center justify-end">
            <span className={cn('text-xs font-bold tracking-wide', statusClass)}>{totals.status}</span>
          </div>
        </div>
      </div>

      {invoice.paymentMethod ? (
        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Payment Method</p>
          <p className="mt-1">{invoice.paymentMethod}</p>
        </div>
      ) : null}

      {(invoice.paymentDetails || defaultInvoiceBankDetails()) ? (
        <div className="mt-8 pt-4 border-t border-gray-100 text-[12px] text-gray-600">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Payment Details</p>
          <p className="whitespace-pre-wrap">{invoice.paymentDetails || defaultInvoiceBankDetails()}</p>
        </div>
      ) : null}
    </div>
  );
}
