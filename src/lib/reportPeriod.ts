import { format, startOfMonth, endOfMonth } from 'date-fns';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const FILTER_CTRL = 'h-7 px-3 text-xs font-bold rounded-lg border border-gray-200 bg-white shadow-sm leading-none';

export function monthRange(year: number, month: number) {
  const d = new Date(year, month, 1);
  return {
    from: format(startOfMonth(d), 'yyyy-MM-dd'),
    to: format(endOfMonth(d), 'yyyy-MM-dd'),
  };
}

export function isFullMonthRange(from: string, to: string, year: number, month: number) {
  const expected = monthRange(year, month);
  return from === expected.from && to === expected.to;
}
