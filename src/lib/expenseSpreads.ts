import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ExpenseSpread, MonthlyExpense } from '@/types';
import { formatCurrency } from '@/lib/utils';

export function monthsInYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

export function spreadDocId(year: number, categoryId: string): string {
  return `${year}__${categoryId}`;
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

export function getCombinedAmounts(expense?: MonthlyExpense | null): Record<string, number> {
  if (!expense) return {};
  const manual = expense.amounts || {};
  const spread = expense.spreadAmounts || {};
  const ids = new Set([...Object.keys(manual), ...Object.keys(spread)]);
  const out: Record<string, number> = {};
  for (const id of ids) {
    const total = (Number(manual[id]) || 0) + (Number(spread[id]) || 0);
    if (total > 0) out[id] = total;
  }
  return out;
}

export function sumCombinedExpenseAmounts(expense?: MonthlyExpense | null): number {
  return Object.values(getCombinedAmounts(expense)).reduce((s, v) => s + v, 0);
}

function stripSpreadFromMonth(
  data: Partial<MonthlyExpense>,
  categoryId: string,
): { spreadAmounts: Record<string, number>; spreadIds: Record<string, string> } {
  const spreadAmounts = { ...(data.spreadAmounts || {}) };
  const spreadIds = { ...(data.spreadIds || {}) };
  delete spreadAmounts[categoryId];
  delete spreadIds[categoryId];
  return { spreadAmounts, spreadIds };
}

export async function saveExpenseSpread(params: {
  year: number;
  categoryId: string;
  categoryLabel: string;
  totalAmount: number;
  note?: string;
  updatedBy: string;
}): Promise<string> {
  const { year, categoryId, categoryLabel, totalAmount, note, updatedBy } = params;
  const months = monthsInYear(year);
  const shares = splitAmountEvenly(totalAmount, months.length);
  const spreadId = spreadDocId(year, categoryId);
  const now = new Date().toISOString();

  const existingSpreadSnap = await getDoc(doc(db, 'expenseSpreads', spreadId));
  const previousMonths = existingSpreadSnap.exists()
    ? (existingSpreadSnap.data() as ExpenseSpread).months
    : [];

  const monthsToRead = [...new Set([...previousMonths, ...months])];
  const monthDataByKey = new Map<string, MonthlyExpense | null>();
  await Promise.all(
    monthsToRead.map(async (month) => {
      const snap = await getDoc(doc(db, 'monthlyExpenses', month));
      monthDataByKey.set(month, snap.exists() ? ({ ...snap.data(), id: snap.id } as MonthlyExpense) : null);
    }),
  );

  const batch = writeBatch(db);

  for (const month of previousMonths) {
    if (months.includes(month)) continue;
    const existing = monthDataByKey.get(month);
    if (!existing) continue;
    const { spreadAmounts, spreadIds } = stripSpreadFromMonth(existing, categoryId);
    batch.set(doc(db, 'monthlyExpenses', month), {
      ...existing,
      month,
      spreadAmounts,
      spreadIds,
      updatedAt: now,
      updatedBy,
    });
  }

  const spreadDoc: ExpenseSpread = {
    id: spreadId,
    year,
    categoryId,
    categoryLabel,
    totalAmount,
    months,
    perMonth: Object.fromEntries(months.map((m, i) => [m, shares[i]])),
    note: note?.trim() || '',
    updatedAt: now,
    updatedBy,
  };
  batch.set(doc(db, 'expenseSpreads', spreadId), spreadDoc);

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    const existing = monthDataByKey.get(month);
    const categoryLabels = { ...(existing?.categoryLabels || {}), [categoryId]: categoryLabel };

    batch.set(doc(db, 'monthlyExpenses', month), {
      month,
      amounts: existing?.amounts || {},
      spreadAmounts: {
        ...(existing?.spreadAmounts || {}),
        [categoryId]: shares[i],
      },
      spreadIds: {
        ...(existing?.spreadIds || {}),
        [categoryId]: spreadId,
      },
      categoryLabels,
      note: existing?.note || '',
      updatedAt: now,
      updatedBy,
    }, { merge: true });
  }

  await batch.commit();
  return spreadId;
}

export function findSpreadForCategoryYear(
  expenseSpreads: ExpenseSpread[],
  year: number,
  categoryId: string,
): ExpenseSpread | undefined {
  const id = spreadDocId(year, categoryId);
  return expenseSpreads.find(s => s.id === id);
}

export function spreadHintForCategory(
  expense: MonthlyExpense | null | undefined,
  categoryId: string,
  expenseSpreads: ExpenseSpread[],
): string | null {
  const spreadId = expense?.spreadIds?.[categoryId];
  if (!spreadId) return null;
  const spread = expenseSpreads.find(s => s.id === spreadId);
  if (!spread) return null;
  const perMonth = spread.perMonth[expense?.month || ''] ?? spread.totalAmount / spread.months.length;
  return `Spread: ${formatCurrency(perMonth)}/mo · ${spread.months.length} months`;
}
