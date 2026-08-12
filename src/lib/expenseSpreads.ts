import { addDoc, collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ExpenseSpread } from '@/types';
import { formatCurrency } from '@/lib/utils';

export function asAmountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, number>;
}

export function monthsInYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** Split total into equal monthly amounts; remainder goes on the last month. */
export function splitAmountEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => {
    const cents = base + (i === count - 1 ? remainder : 0);
    return cents / 100;
  });
}

export function formatSpreadMonthLabel(monthKeys: string[]): string {
  if (monthKeys.length === 0) return '';
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sorted = [...monthKeys].sort();
  const indices = sorted.map(k => parseInt(k.slice(5, 7), 10) - 1);
  const year = sorted[0]?.slice(0, 4) || '';
  if (indices.length === 12) return `Jan–Dec ${year}`;
  if (indices.length === 1) {
    const label = MONTH_SHORT[indices[0]];
    return label ? `${label} ${year}` : year;
  }
  let consecutive = true;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      consecutive = false;
      break;
    }
  }
  if (consecutive) {
    const start = MONTH_SHORT[indices[0]];
    const end = MONTH_SHORT[indices[indices.length - 1]];
    if (start && end) return `${start}–${end} ${year}`;
  }
  return `${indices.map(i => MONTH_SHORT[i] || '?').join(', ')} ${year}`.trim();
}

function spreadMonths(spread: ExpenseSpread): string[] {
  return Array.isArray(spread.months) ? spread.months : [];
}

export function spreadDisplayName(spread: ExpenseSpread): string {
  return spread.name?.trim() || spread.note?.trim() || spread.categoryLabel || 'Spread';
}

/** Amount this spread contributes to one month (0 when the month is not covered). */
export function spreadAmountForMonth(spread: ExpenseSpread, monthKey: string): number {
  const months = spreadMonths(spread);
  if (!months.includes(monthKey)) return 0;
  const stored = spread.perMonth?.[monthKey];
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored;
  const fallback = (Number(spread.totalAmount) || 0) / months.length;
  return Number.isFinite(fallback) ? fallback : 0;
}

export function spreadsForYear(spreads: ExpenseSpread[], year: number): ExpenseSpread[] {
  return spreads
    .filter(s => s.year === year)
    .sort((a, b) => spreadDisplayName(a).localeCompare(spreadDisplayName(b)));
}

export function spreadsForMonth(spreads: ExpenseSpread[], monthKey: string): ExpenseSpread[] {
  return spreads.filter(s => spreadAmountForMonth(s, monthKey) > 0);
}

/** categoryId → total spread amount landing in this month, summed across every spread. */
export function getSpreadAmountsForMonth(
  monthKey: string,
  spreads: ExpenseSpread[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spread of spreads) {
    const amount = spreadAmountForMonth(spread, monthKey);
    if (amount <= 0) continue;
    out[spread.categoryId] = (out[spread.categoryId] || 0) + amount;
  }
  return out;
}

export function spreadHintForCategory(
  monthKey: string,
  categoryId: string,
  spreads: ExpenseSpread[],
): string | null {
  const matches = spreads.filter(
    s => s.categoryId === categoryId && spreadAmountForMonth(s, monthKey) > 0,
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const spread = matches[0];
    const months = spreadMonths(spread).length;
    return `Spread: ${formatCurrency(spreadAmountForMonth(spread, monthKey))}/mo · ${months} months`;
  }
  return `Spread: ${matches.length} spreads this month`;
}

/** Creates a spread when no id is given, otherwise overwrites that spread. */
export async function saveExpenseSpread(params: {
  id?: string;
  name: string;
  year: number;
  categoryId: string;
  categoryLabel: string;
  totalAmount: number;
  months: string[];
  note?: string;
  updatedBy: string;
}): Promise<string> {
  const months = [...params.months].sort();
  if (months.length === 0) {
    throw new Error('At least one month must be selected.');
  }
  const shares = splitAmountEvenly(params.totalAmount, months.length);

  const payload = {
    name: params.name.trim(),
    year: params.year,
    categoryId: params.categoryId,
    categoryLabel: params.categoryLabel,
    totalAmount: params.totalAmount,
    months,
    perMonth: Object.fromEntries(months.map((m, i) => [m, shares[i]])),
    note: params.note?.trim() || '',
    updatedAt: new Date().toISOString(),
    updatedBy: params.updatedBy,
  };

  if (params.id) {
    await setDoc(doc(db, 'expenseSpreads', params.id), payload);
    return params.id;
  }
  const created = await addDoc(collection(db, 'expenseSpreads'), payload);
  return created.id;
}

export async function deleteExpenseSpread(spreadId: string): Promise<void> {
  await deleteDoc(doc(db, 'expenseSpreads', spreadId));
}
