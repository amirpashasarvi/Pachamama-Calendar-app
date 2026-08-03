export function getPaymentEntries(financials: {
  payments?: number[];
  paidLater1?: number;
  paidLater2?: number;
}): number[] {
  if (Array.isArray(financials.payments)) {
    return financials.payments;
  }
  const entries: number[] = [];
  if ((financials.paidLater1 || 0) > 0) entries.push(financials.paidLater1!);
  if ((financials.paidLater2 || 0) > 0) entries.push(financials.paidLater2!);
  return entries;
}

export function getLaterPaymentsTotal(financials: {
  payments?: number[];
  paidLater1?: number;
  paidLater2?: number;
}): number {
  return getPaymentEntries(financials).reduce((sum, amount) => sum + (amount || 0), 0);
}

export function getCollectedAmount(financials: {
  deposit?: number;
  payments?: number[];
  paidLater1?: number;
  paidLater2?: number;
}): number {
  return (financials.deposit || 0) + getLaterPaymentsTotal(financials);
}

export function paymentsFromLegacy(
  paidLater1?: number,
  paidLater2?: number,
  payments?: number[],
): number[] {
  if (Array.isArray(payments)) return payments;
  return getPaymentEntries({ paidLater1, paidLater2 });
}

export function syncLegacyPaidLaterFields(payments: number[]): { paidLater1: number; paidLater2: number } {
  return {
    paidLater1: payments[0] || 0,
    paidLater2: payments[1] || 0,
  };
}
