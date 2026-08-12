import React, { useMemo, useState, useEffect, startTransition } from 'react';
import { motion } from 'motion/react';
import { X, DollarSign, ChevronLeft, ChevronRight, Save, AlertCircle, Pencil, Trash2, Receipt } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import Modal from '@/components/ui/Modal';
import { Booking, VenueHire, Room, ConfigOption } from '@/types';
import { useDashboardStats, UpcomingItem, OutstandingItem, PeriodRange } from '@/hooks/useDashboardStats';
import { useBooking } from '@/hooks/useBooking';
import { useAuth } from '@/hooks/useAuth';
import BookingModal from '@/components/modals/BookingModal';
import VenueHireModal from '@/components/modals/VenueHireModal';
import { cn, formatCurrency, safeFormatISO } from '@/lib/utils';
import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import { MONTH_LABELS, FILTER_CTRL, monthRange, isFullMonthRange } from '@/lib/reportPeriod';
import {
  monthKeyFromRange,
  sumMonthlyExpenseTotal,
  sumExpenseAmounts,
  splitAmountEvenly,
  monthsInYear,
  saveExpenseSpread,
  deleteExpenseSpread,
  spreadHintForCategory,
  spreadsForYear,
  spreadAmountForMonth,
  getSpreadAmountsForMonth,
  spreadDisplayName,
  formatSpreadMonthLabel,
  asAmountMap,
} from '@/lib/monthlyExpenses';
import {
  getRecurringAmountsForMonth,
  recurringHintForCategory,
  formatMonthsOfYearLabel,
  monthsOfYearFromKeys,
  monthKeysFromMonthsOfYear,
} from '@/lib/recurringExpenses';
import { MonthlyExpense, ExpenseSpread, RecurringExpense } from '@/types';
import { doc, setDoc, addDoc, deleteDoc, updateDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/services/firebase';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  venueHires: VenueHire[];
  rooms: Room[];
  bookingChannels: ConfigOption[];
  paymentChannels: ConfigOption[];
}

type Tab = 'overview' | 'expenses' | 'retreats' | 'coliving' | 'venue' | 'exchange';
type Period = 'All' | 'Month';

// ── Shared UI primitives ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, tone = 'default' }: {
  label: string; value: string; sub?: string;
  tone?: 'default' | 'green' | 'amber' | 'rose' | 'blue';
}) {
  const toneClass = {
    default: 'text-gray-900',
    green: 'text-green-700',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    blue: 'text-blue-600',
  }[tone];
  return (
    <div className="bg-white rounded-2xl border p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      <span className={cn('text-xl font-black tracking-tight', toneClass)}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

function MetricRow({ label, value, valueTone = 'default' }: {
  label: string;
  value: string;
  valueTone?: 'default' | 'green' | 'amber' | 'rose' | 'blue';
}) {
  const valueClass = {
    default: 'text-gray-900',
    green: 'text-green-700',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    blue: 'text-blue-600',
  }[valueTone];
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className={cn('text-xs font-bold', valueTone === 'rose' ? 'text-rose-600' : 'text-gray-500')}>{label}</span>
      <span className={cn('text-xs font-black', valueClass)}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, max, display }: { label: string; value: number; max: number; display: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700 truncate max-w-[60%]">{label}</span>
        <span className="text-xs font-black text-gray-900">{display}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function UpcomingTable({ items, showBalance = true }: { items: UpcomingItem[]; showBalance?: boolean }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 italic py-4 text-center">No upcoming items</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Name</th>
            <th className="pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Room</th>
            <th className="pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Check-in</th>
            <th className="pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Nights</th>
            {showBalance && (
              <th className="pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Balance</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="py-2 pr-4">
                <span className="text-xs font-bold text-gray-900 truncate block max-w-[140px]">{item.name}</span>
              </td>
              <td className="py-2 pr-4 hidden sm:table-cell">
                <span className="text-xs text-gray-500 font-bold">{item.roomName}</span>
              </td>
              <td className="py-2 pr-4">
                <span className="text-xs font-bold text-gray-700">{safeFormatISO(item.checkIn, 'dd MMM')}</span>
              </td>
              <td className="py-2 text-right">
                <span className="text-xs font-black text-gray-700">{item.nights}n</span>
              </td>
              {showBalance && (
                <td className="py-2 pl-4 text-right">
                  {item.remaining > 0 ? (
                    <span className="text-xs font-black text-amber-600">{formatCurrency(item.remaining)}</span>
                  ) : (
                    <span className="text-xs font-black text-green-600">Paid</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-bold text-gray-400 mb-3">{children}</h3>
  );
}

const EXPENSE_SOURCE_LABEL = {
  month: 'current month',
  spread: 'spread across months',
  recurring: 'repeats monthly',
} as const;

type ExpenseSource = keyof typeof EXPENSE_SOURCE_LABEL;

function expenseSourceLabel(categoryName: string, source: ExpenseSource): string {
  return `${categoryName} (${EXPENSE_SOURCE_LABEL[source]})`;
}

interface ExpenseSourceRow {
  key: string;
  label: string;
  amount: number;
  hint: string | null;
}

function buildExpenseSourceRows(
  monthKey: string,
  expenseCategories: ConfigOption[],
  monthlyExpense: MonthlyExpense | undefined,
  expenseSpreads: ExpenseSpread[],
  recurringExpenses: RecurringExpense[],
): ExpenseSourceRow[] {
  const manual = asAmountMap(monthlyExpense?.amounts);
  const spread = getSpreadAmountsForMonth(monthKey, expenseSpreads);
  const recurringByCategory = getRecurringAmountsForMonth(monthKey, recurringExpenses);
  const activeCategoryIds = new Set(expenseCategories.map(c => c.id));
  const rows: ExpenseSourceRow[] = [];

  const pushRow = (
    categoryId: string,
    categoryName: string,
    source: ExpenseSource,
    amount: number,
    hint: string | null = null,
  ) => {
    if (amount <= 0) return;
    rows.push({
      key: `${categoryId}:${source}`,
      label: expenseSourceLabel(categoryName, source),
      amount,
      hint,
    });
  };

  for (const category of expenseCategories) {
    const manualAmount = Number(manual[category.id]) || 0;
    const spreadAmount = Number(spread[category.id]) || 0;
    const recurringAmount = Number(recurringByCategory[category.id]) || 0;
    pushRow(category.id, category.name, 'month', manualAmount);
    pushRow(
      category.id,
      category.name,
      'spread',
      spreadAmount,
      spreadAmount > 0 ? spreadHintForCategory(monthKey, category.id, expenseSpreads) : null,
    );
    pushRow(
      category.id,
      category.name,
      'recurring',
      recurringAmount,
      recurringAmount > 0 ? recurringHintForCategory(monthKey, category.id, recurringExpenses) : null,
    );
  }

  const archivedIds = new Set([
    ...Object.keys(manual),
    ...Object.keys(spread),
    ...Object.keys(recurringByCategory),
  ].filter(id => !activeCategoryIds.has(id)));

  for (const categoryId of archivedIds) {
    const categoryName = monthlyExpense?.categoryLabels?.[categoryId]
      || expenseSpreads.find(s => s.categoryId === categoryId)?.categoryLabel
      || 'Removed category';
    pushRow(categoryId, categoryName, 'month', Number(manual[categoryId]) || 0);
    pushRow(
      categoryId,
      categoryName,
      'spread',
      Number(spread[categoryId]) || 0,
      Number(spread[categoryId]) > 0 ? spreadHintForCategory(monthKey, categoryId, expenseSpreads) : null,
    );
    pushRow(
      categoryId,
      categoryName,
      'recurring',
      Number(recurringByCategory[categoryId]) || 0,
      Number(recurringByCategory[categoryId]) > 0
        ? recurringHintForCategory(monthKey, categoryId, recurringExpenses)
        : null,
    );
  }

  const sourceOrder: Record<ExpenseSource, number> = { month: 0, spread: 1, recurring: 2 };
  rows.sort((a, b) => {
    const baseA = a.label.replace(/\s\([^)]+\)$/, '');
    const baseB = b.label.replace(/\s\([^)]+\)$/, '');
    const nameCompare = baseA.localeCompare(baseB);
    if (nameCompare !== 0) return nameCompare;
    const sourceA = a.key.split(':')[1] as ExpenseSource;
    const sourceB = b.key.split(':')[1] as ExpenseSource;
    return sourceOrder[sourceA] - sourceOrder[sourceB];
  });

  return rows;
}

// ── Tab sections ──────────────────────────────────────────────────────────────

function OverviewSection({
  stats,
  totalExpenses,
  isMonthView,
  onOpenOutstanding,
}: {
  stats: ReturnType<typeof useDashboardStats>;
  totalExpenses: number;
  isMonthView: boolean;
  onOpenOutstanding: (item: OutstandingItem) => void;
}) {
  const g = stats.global;
  const maxTypeRevenue = g.revenueByType[0]?.revenue ?? 1;
  const incomeAfterCommissions = g.totalRevenue - g.totalCommissions;
  const netIncome = incomeAfterCommissions - totalExpenses;

  return (
    <div className="space-y-6">
      {isMonthView ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Gross Income" value={formatCurrency(g.totalRevenue)} tone="default" />
          <StatCard label="Commissions" value={formatCurrency(g.totalCommissions)} tone="blue" />
          <StatCard label="Expenses" value={formatCurrency(totalExpenses)} tone="amber" />
          <StatCard label="Net Income" value={formatCurrency(netIncome)} tone={netIncome >= 0 ? 'green' : 'rose'} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-w-xl">
          <StatCard label="Gross Income" value={formatCurrency(g.totalRevenue)} tone="default" />
          <StatCard label="Commissions" value={formatCurrency(g.totalCommissions)} tone="blue" />
        </div>
      )}

      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">
        Based on {g.bookingCount} records · active stays pro-rated · cancelled counted on check-in date
        {!isMonthView && ' · select a month to see expenses and net income'}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <SectionTitle>Revenue by Booking Type</SectionTitle>
            {g.revenueByType.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No data</p>
            ) : (
              <div className="space-y-3">
                {g.revenueByType.map(row => (
                  <React.Fragment key={row.type}>
                    <BarRow
                      label={`${row.type} (${row.count})`}
                      value={row.revenue}
                      max={maxTypeRevenue}
                      display={formatCurrency(row.revenue)}
                    />
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border p-4 space-y-1">
            <SectionTitle>Top Booking Channels</SectionTitle>
            {g.topChannels.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No data</p>
            ) : (
              g.topChannels.map(ch => (
                <React.Fragment key={ch.name}>
                  <MetricRow label={`${ch.name} (${ch.count})`} value={formatCurrency(ch.revenue)} />
                </React.Fragment>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-4 space-y-1">
          <SectionTitle>Financial Summary</SectionTitle>
          <MetricRow label="Booking channel commissions" value={formatCurrency(g.bookingCommissions)} />
          <MetricRow label="Payment channel commissions" value={formatCurrency(g.paymentCommissions)} />
          <MetricRow label="After commissions" value={formatCurrency(incomeAfterCommissions)} />
          <div className="pt-3 mt-1 border-t border-gray-100">
            <MetricRow label="Collected" value={formatCurrency(g.totalCollected)} />
            {g.totalOutstanding > 0 && (
              <>
                <MetricRow label="Still to collect" value={formatCurrency(g.totalOutstanding)} valueTone="rose" />
                {g.outstandingItems.length > 0 && (
                  <div className="pt-3 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Unpaid</p>
                    {g.outstandingItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onOpenOutstanding(item)}
                        className="w-full flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-rose-50 transition-colors text-left group"
                      >
                        <span className="text-xs font-bold text-gray-800 truncate group-hover:text-rose-700 underline-offset-2 group-hover:underline">
                          {item.name}
                          {item.isVenueHire && (
                            <span className="ml-1.5 text-[10px] font-black uppercase text-gray-400 no-underline">Venue</span>
                          )}
                        </span>
                        <span className="text-xs font-black text-rose-600 shrink-0">{formatCurrency(item.remaining)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RetreatsSection({ stats }: { stats: ReturnType<typeof useDashboardStats> }) {
  const r = stats.retreats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={formatCurrency(r.totalRevenue)} />
        <StatCard label="Collected" value={formatCurrency(r.totalCollected)} tone="green" />
        <StatCard label="Outstanding" value={formatCurrency(r.totalOutstanding)} tone="amber" />
        <StatCard label="Retreat Guests" value={String(r.totalGuests)} sub={`${r.bookingCount} bookings`} tone="blue" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-4">
          <SectionTitle>Averages</SectionTitle>
          <MetricRow label="Revenue per booking" value={r.bookingCount ? formatCurrency(r.avgRevenue) : '—'} />
          <MetricRow label="Avg stay duration" value={r.bookingCount ? `${r.avgNights.toFixed(1)} nights` : '—'} />
          <MetricRow label="Top booking channel" value={r.topChannel} />
          <MetricRow label="Total retreat bookings" value={String(r.bookingCount)} />
        </div>

        <div className="bg-white rounded-2xl border p-4">
          <SectionTitle>Upcoming with Balance Due</SectionTitle>
          <UpcomingTable items={r.upcoming} />
        </div>
      </div>
    </div>
  );
}

function ColivingSection({ stats }: { stats: ReturnType<typeof useDashboardStats> }) {
  const c = stats.coliving;
  const maxRoomCount = c.topRooms[0]?.count ?? 1;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={formatCurrency(c.totalRevenue)} />
        <StatCard label="Collected" value={formatCurrency(c.totalCollected)} tone="green" />
        <StatCard label="Outstanding" value={formatCurrency(c.totalOutstanding)} tone="amber" />
        <StatCard label="Avg Stay" value={c.bookingCount ? `${c.avgNights.toFixed(1)} nights` : '—'} sub={`${c.bookingCount} bookings`} tone="blue" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <SectionTitle>Most Used Rooms</SectionTitle>
          {c.topRooms.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No data</p>
          ) : (
            <div className="space-y-3">
              {c.topRooms.map(r => (
                <React.Fragment key={r.name}>
                  <BarRow label={r.name} value={r.count} max={maxRoomCount} display={`${r.count} bookings`} />
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="pt-3 mt-1 border-t border-gray-100">
            <MetricRow label="Avg nightly rate" value={c.avgNightlyRate ? formatCurrency(c.avgNightlyRate) : '—'} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-4">
          <SectionTitle>Upcoming Stays</SectionTitle>
          <UpcomingTable items={c.upcoming} />
        </div>
      </div>
    </div>
  );
}

function VenueHireSection({ stats }: { stats: ReturnType<typeof useDashboardStats> }) {
  const v = stats.venueHire;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={formatCurrency(v.totalRevenue)} />
        <StatCard label="Collected" value={formatCurrency(v.totalCollected)} tone="green" />
        <StatCard label="Outstanding" value={formatCurrency(v.totalOutstanding)} tone="amber" />
        <StatCard label="Events" value={String(v.eventCount)} tone="blue" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-4">
          <SectionTitle>Event Metrics</SectionTitle>
          <MetricRow label="Avg event duration" value={v.eventCount ? `${v.avgDuration.toFixed(1)} nights` : '—'} />
          <MetricRow label="Avg guests per event" value={v.eventCount ? `${Math.round(v.avgGuestCount)} guests` : '—'} />
          <MetricRow label="Avg revenue per event" value={v.eventCount ? formatCurrency(v.totalRevenue / v.eventCount) : '—'} />
          <MetricRow label="Avg collected per event" value={v.eventCount ? formatCurrency(v.totalCollected / v.eventCount) : '—'} />
        </div>

        <div className="bg-white rounded-2xl border p-4">
          <SectionTitle>Upcoming Events</SectionTitle>
          <UpcomingTable items={v.upcoming} />
        </div>
      </div>
    </div>
  );
}

function HomeExchangeSection({ stats }: { stats: ReturnType<typeof useDashboardStats> }) {
  const h = stats.homeExchange;
  const c = stats.coliving;
  const maxRoomCount = h.topRooms[0]?.count ?? 1;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Stays" value={String(h.stayCount)} />
        <StatCard label="Total Nights" value={String(h.totalNights)} tone="blue" />
        <StatCard label="Avg Stay" value={h.stayCount ? `${h.avgNights.toFixed(1)} nights` : '—'} />
        <StatCard
          label="Est. Value"
          value={h.estimatedValue > 0 ? formatCurrency(h.estimatedValue) : '—'}
          sub={c.avgNightlyRate > 0 ? `at ${formatCurrency(c.avgNightlyRate)}/night (coliving avg)` : 'set coliving rate first'}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <SectionTitle>Rooms Used for Exchanges</SectionTitle>
          {h.topRooms.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No data</p>
          ) : (
            <div className="space-y-3">
              {h.topRooms.map(r => (
                <React.Fragment key={r.name}>
                  <BarRow label={r.name} value={r.count} max={maxRoomCount} display={`${r.count} stays`} />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border p-4">
          <SectionTitle>Upcoming Exchanges</SectionTitle>
          <UpcomingTable items={h.upcoming} showBalance={false} />
        </div>
      </div>
    </div>
  );
}

function StatsTabContent({
  tab,
  bookings,
  venueHires,
  rooms,
  bookingChannels,
  paymentChannels,
  periodRange,
  totalExpenses,
  isMonthView,
  onOpenOutstanding,
}: {
  tab: Exclude<Tab, 'expenses'>;
  bookings: Booking[];
  venueHires: VenueHire[];
  rooms: Room[];
  bookingChannels: ConfigOption[];
  paymentChannels: ConfigOption[];
  periodRange: PeriodRange | null;
  totalExpenses: number;
  isMonthView: boolean;
  onOpenOutstanding: (item: OutstandingItem) => void;
}) {
  const stats = useDashboardStats(
    bookings, venueHires, rooms, bookingChannels, paymentChannels, periodRange,
  );

  if (tab === 'overview') {
    return (
      <OverviewSection
        stats={stats}
        totalExpenses={totalExpenses}
        isMonthView={isMonthView}
        onOpenOutstanding={onOpenOutstanding}
      />
    );
  }
  if (tab === 'retreats') return <RetreatsSection stats={stats} />;
  if (tab === 'coliving') return <ColivingSection stats={stats} />;
  if (tab === 'venue') return <VenueHireSection stats={stats} />;
  return <HomeExchangeSection stats={stats} />;
}

function ExpensesReportSection({
  monthKey,
  expenseCategories,
  monthlyExpense,
  expenseSpreads,
  recurringExpenses,
}: {
  monthKey: string | null;
  expenseCategories: ConfigOption[];
  monthlyExpense?: MonthlyExpense;
  expenseSpreads: ExpenseSpread[];
  recurringExpenses: RecurringExpense[];
}) {
  if (!monthKey) {
    return (
      <div className="bg-white rounded-2xl border p-8 text-center">
        <p className="text-sm font-bold text-gray-700">Select a month to view expenses</p>
        <p className="text-xs text-gray-400 mt-2">Use the month picker above.</p>
      </div>
    );
  }

  const monthLabel = safeFormatISO(`${monthKey}-01`, 'MMMM yyyy', monthKey);
  const recurringByCategory = getRecurringAmountsForMonth(monthKey, recurringExpenses);
  const expenseRows = buildExpenseSourceRows(
    monthKey,
    expenseCategories,
    monthlyExpense,
    expenseSpreads,
    recurringExpenses,
  );

  const spreadByCategory = getSpreadAmountsForMonth(monthKey, expenseSpreads);
  const total = sumMonthlyExpenseTotal(monthlyExpense, recurringByCategory, spreadByCategory);
  const savedNote = monthlyExpense?.note;
  const hasData = total > 0 || !!savedNote?.trim();
  const updatedAt = monthlyExpense?.updatedAt;
  const updatedBy = monthlyExpense?.updatedBy;

  let updatedLabel = '';
  if (updatedAt) {
    try {
      updatedLabel = format(parseISO(updatedAt), 'dd MMM yyyy · HH:mm');
    } catch {
      updatedLabel = updatedAt;
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-gray-900">{monthLabel}</h3>
            <p className="text-xs text-gray-400 mt-1">Monthly expense totals — detail stays in Spendee.</p>
          </div>
          {updatedLabel && (
            <p className="text-[10px] text-gray-400 text-right shrink-0">
              Updated {updatedLabel}
              {updatedBy && <span className="block">{updatedBy}</span>}
            </p>
          )}
        </div>

        {!hasData ? (
          <div className="py-10 text-center">
            <p className="text-sm font-bold text-gray-600">No expenses recorded for this month</p>
            <p className="text-xs text-gray-400 mt-1">Use Manage expenses to add them.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {expenseRows.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">No category amounts recorded.</p>
              ) : (
                expenseRows.map(row => (
                  <div key={row.key} className="py-1 border-b border-gray-50 last:border-0">
                    <MetricRow label={row.label} value={formatCurrency(row.amount)} />
                    {row.hint && (
                      <p className="text-[10px] text-gray-400 pb-1.5">{row.hint}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {savedNote?.trim() && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Note</p>
                <p className="text-xs text-gray-700">{savedNote}</p>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <MetricRow label="Total expenses" value={formatCurrency(total)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type ExpenseEntryTab = 'month' | 'spread' | 'recurring';

function ExpensesEntryPanel({
  year,
  onYearChange,
  expenseCategories,
  monthlyExpenses,
  expenseSpreads,
  recurringExpenses,
  onSaved,
  onClose,
}: {
  year: number;
  onYearChange: (year: number) => void;
  expenseCategories: ConfigOption[];
  monthlyExpenses: MonthlyExpense[];
  expenseSpreads: ExpenseSpread[];
  recurringExpenses: RecurringExpense[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ExpenseEntryTab>('month');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onYearChange(year - 1)}
          className="h-8 w-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label="Previous year"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-black text-gray-900 min-w-[3.5rem] text-center">{year}</span>
        <button
          type="button"
          onClick={() => onYearChange(year + 1)}
          className="h-8 w-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label="Next year"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => setTab('month')}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
            tab === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Current Month
        </button>
        <button
          type="button"
          onClick={() => setTab('spread')}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
            tab === 'spread' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Spread Across Months
        </button>
        <button
          type="button"
          onClick={() => setTab('recurring')}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
            tab === 'recurring' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Repeats Monthly
        </button>
      </div>

      <div className="min-h-[30rem] sm:min-h-[32rem] flex flex-col">
        {tab === 'month' ? (
          <ExpensesMonthTab
            year={year}
            expenseCategories={expenseCategories}
            monthlyExpenses={monthlyExpenses}
            onSaved={onSaved}
            onClose={onClose}
          />
        ) : tab === 'spread' ? (
          <ExpensesSpreadForm
            year={year}
            expenseCategories={expenseCategories}
            expenseSpreads={expenseSpreads}
            onClose={onClose}
          />
        ) : (
          <ExpensesRecurringForm
            expenseCategories={expenseCategories}
            recurringExpenses={recurringExpenses}
            previewYear={year}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function ExpensesMonthTab({
  year,
  expenseCategories,
  monthlyExpenses,
  onSaved,
  onClose,
}: {
  year: number;
  expenseCategories: ConfigOption[];
  monthlyExpenses: MonthlyExpense[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const yearMonths = useMemo(() => monthsInYear(year), [year]);

  useEffect(() => {
    setSelectedMonthKey(null);
  }, [year]);

  const findMonthlyExpense = (monthKey: string) =>
    monthlyExpenses.find(e => e.month === monthKey || e.id === monthKey);

  const monthTotals = yearMonths.map(monthKey => ({
    monthKey,
    total: sumExpenseAmounts(findMonthlyExpense(monthKey)?.amounts),
  }));
  const filledMonths = monthTotals.filter(m => m.total > 0);

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400">
        Pick a month, then enter that month&apos;s totals from Spendee.
      </p>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase">Month</label>
        <div className="grid grid-cols-6 gap-1">
          {yearMonths.map((monthKey, i) => {
            const hasData = monthTotals[i].total > 0;
            return (
              <button
                key={monthKey}
                type="button"
                onClick={() => setSelectedMonthKey(monthKey)}
                className={cn(
                  'h-9 rounded-lg text-[11px] font-bold transition-all',
                  selectedMonthKey === monthKey
                    ? 'bg-green-600 text-white shadow-sm'
                    : hasData
                      ? 'text-gray-900 hover:bg-gray-100'
                      : 'text-gray-600 hover:bg-gray-100',
                )}
              >
                {MONTH_LABELS[i]}
                {hasData && (
                  <span
                    className={cn(
                      'block w-1 h-1 rounded-full mx-auto mt-0.5',
                      selectedMonthKey === monthKey ? 'bg-white' : 'bg-green-600',
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedMonthKey ? (
        <ExpensesEntryForm
          key={selectedMonthKey}
          monthKey={selectedMonthKey}
          expenseCategories={expenseCategories}
          monthlyExpense={findMonthlyExpense(selectedMonthKey)}
          onSaved={onSaved}
          onClose={onClose}
        />
      ) : (
        <div className="space-y-4">
          <div className="py-8 text-center border border-dashed border-gray-200 rounded-xl">
            <p className="text-sm font-bold text-gray-600">Select a month above</p>
            <p className="text-xs text-gray-400 mt-1">Nothing is selected yet.</p>
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 pb-1">
              Months with entries in {year}
            </p>
            {filledMonths.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-1">No months filled in yet.</p>
            ) : (
              filledMonths.map(({ monthKey, total }) => (
                <button
                  key={monthKey}
                  type="button"
                  onClick={() => setSelectedMonthKey(monthKey)}
                  className="w-full flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-gray-800">
                    {safeFormatISO(`${monthKey}-01`, 'MMMM yyyy', monthKey)}
                  </span>
                  <span className="text-xs font-black text-gray-900 shrink-0">{formatCurrency(total)}</span>
                </button>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpensesEntryForm({
  monthKey,
  expenseCategories,
  monthlyExpense,
  onSaved,
  onClose,
}: {
  monthKey: string;
  expenseCategories: ConfigOption[];
  monthlyExpense?: MonthlyExpense;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const categoryIds = useMemo(
    () => expenseCategories.map(c => c.id).join('\0'),
    [expenseCategories],
  );

  const persistedSnapshot = useMemo(
    () => JSON.stringify({
      monthKey,
      amounts: monthlyExpense?.amounts ?? null,
      note: monthlyExpense?.note ?? '',
      categoryIds,
    }),
    [monthKey, monthlyExpense?.amounts, monthlyExpense?.note, categoryIds],
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const category of expenseCategories) {
      const value = monthlyExpense?.amounts?.[category.id];
      next[category.id] = value != null && value !== 0 ? String(value) : '';
    }
    setAmounts(next);
    setNote(monthlyExpense?.note || '');
    setSaveError(null);
    setSaveSuccess(false);
  }, [persistedSnapshot]);

  const savedAmounts = monthlyExpense?.amounts ?? {};
  const savedLabels = monthlyExpense?.categoryLabels;
  const monthLabel = safeFormatISO(`${monthKey}-01`, 'MMMM yyyy', monthKey);
  const activeCategoryIds = new Set(expenseCategories.map(c => c.id));
  const archivedEntries = Object.entries(savedAmounts)
    .filter(([id, value]) => !activeCategoryIds.has(id) && (Number(value) || 0) > 0);

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    const parsedAmounts: Record<string, number> = {};
    for (const [id, raw] of Object.entries(amounts)) {
      const value = raw.trim() === '' ? 0 : Number(raw);
      if (Number.isNaN(value) || value < 0) {
        setSaveError('Enter valid amounts (0 or greater).');
        setIsSaving(false);
        return;
      }
      if (value > 0) parsedAmounts[id] = value;
    }
    for (const [id, value] of archivedEntries) {
      parsedAmounts[id] = Number(value) || 0;
    }

    const categoryLabels: Record<string, string> = { ...(savedLabels || {}) };
    for (const category of expenseCategories) {
      categoryLabels[category.id] = category.name;
    }

    try {
      await setDoc(doc(db, 'monthlyExpenses', monthKey), {
        month: monthKey,
        amounts: parsedAmounts,
        categoryLabels,
        note: note.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.name || profile?.email || '',
      });
      setSaveSuccess(true);
      onSaved();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `monthlyExpenses/${monthKey}`);
      setSaveError('Could not save expenses. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const total = sumExpenseAmounts(
    Object.fromEntries(
      Object.entries(amounts).map(([id, raw]) => [id, raw.trim() === '' ? 0 : Number(raw) || 0])
    )
  ) + archivedEntries.reduce((sum, [, value]) => sum + (Number(value) || 0), 0);

  return (
    <div className="space-y-5">
      <p className="text-xs font-bold text-gray-900">{monthLabel}</p>
      <p className="text-xs text-gray-400 -mt-3">
        Totals paid in this month. Spreads and subscriptions are added separately.
      </p>

      {expenseCategories.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <p className="text-sm font-bold text-gray-600">No expense categories yet</p>
          <p className="text-xs mt-1">Add categories in Settings → Expense Categories first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenseCategories.map(category => (
            <div key={category.id} className="flex items-center gap-3">
              <label className="flex-1 text-xs font-bold text-gray-700">
                {expenseSourceLabel(category.name, 'month')}
              </label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amounts[category.id] ?? ''}
                  onChange={e => setAmounts(prev => ({ ...prev, [category.id]: e.target.value }))}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm font-bold text-right focus:ring-2 focus:ring-black outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {archivedEntries.length > 0 && (
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Removed categories (kept for history)</p>
          {archivedEntries.map(([id, value]) => (
            <div key={id} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-bold truncate">
                {expenseSourceLabel(savedLabels?.[id] || 'Removed category', 'month')}
              </span>
              <span className="font-black text-gray-700">{formatCurrency(Number(value) || 0)}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Totals from Spendee"
          className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
        />
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl">
          <AlertCircle size={14} />
          <span className="text-xs font-bold">{saveError}</span>
        </div>
      )}
      {saveSuccess && (
        <p className="text-xs font-bold text-green-600">Saved for {monthLabel}.</p>
      )}

      <div className="pt-2 border-t border-gray-100 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2.5 bg-white border text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || expenseCategories.length === 0}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Total expenses</span>
          <p className="w-36 text-right text-lg font-black text-gray-900">{formatCurrency(total)}</p>
        </div>
      </div>
    </div>
  );
}

function ExpensesSpreadForm({
  year,
  expenseCategories,
  expenseSpreads,
  onClose,
}: {
  year: number;
  expenseCategories: ConfigOption[];
  expenseSpreads: ExpenseSpread[];
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id || '');
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => monthsInYear(year));
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const yearMonths = useMemo(() => monthsInYear(year), [year]);
  const allMonthsSelected = selectedMonths.length === yearMonths.length
    && yearMonths.every(m => selectedMonths.includes(m));

  const yearSpreads = useMemo(() => spreadsForYear(expenseSpreads, year), [expenseSpreads, year]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategoryId(expenseCategories[0]?.id || '');
    setTotal('');
    setNote('');
    setSelectedMonths(monthsInYear(year));
    setSaveError(null);
  };

  useEffect(() => {
    resetForm();
  }, [year]);

  const startEdit = (spread: ExpenseSpread) => {
    setEditingId(spread.id);
    setName(spread.name || '');
    setCategoryId(spread.categoryId);
    setTotal(String(spread.totalAmount));
    setNote(spread.note || '');
    setSelectedMonths([...(Array.isArray(spread.months) ? spread.months : [])].sort());
    setSaveError(null);
  };

  const monthCount = selectedMonths.length;
  const parsedTotal = total.trim() === '' ? 0 : Number(total);
  const shares = parsedTotal > 0 && monthCount > 0 ? splitAmountEvenly(parsedTotal, monthCount) : [];
  const perMonth = shares[0] ?? 0;
  const selectedCategory = expenseCategories.find(c => c.id === categoryId);

  const toggleAllMonths = (checked: boolean) => {
    setSelectedMonths(checked ? yearMonths : []);
  };

  const toggleMonth = (monthKey: string, checked: boolean) => {
    setSelectedMonths(prev => {
      if (checked) return [...prev, monthKey].sort();
      return prev.filter(m => m !== monthKey);
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Give this spread a short name.');
      return;
    }
    if (!categoryId || !selectedCategory) {
      setSaveError('Select a category.');
      return;
    }
    if (Number.isNaN(parsedTotal) || parsedTotal <= 0) {
      setSaveError('Enter a total amount greater than zero.');
      return;
    }
    if (selectedMonths.length === 0) {
      setSaveError('Select at least one month.');
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      await saveExpenseSpread({
        id: editingId || undefined,
        name: name.trim(),
        year,
        categoryId,
        categoryLabel: selectedCategory.name,
        totalAmount: parsedTotal,
        months: selectedMonths,
        note: note.trim(),
        updatedBy: profile?.name || profile?.email || '',
      });
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `expenseSpreads/${editingId || 'new'}`);
      setSaveError('Could not save spread. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (spread: ExpenseSpread) => {
    if (!window.confirm(`Delete "${spreadDisplayName(spread)}"? Its amounts will be removed from every month it covers.`)) {
      return;
    }

    setSaveError(null);
    setDeletingId(spread.id);
    try {
      await deleteExpenseSpread(spread.id);
      if (editingId === spread.id) resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `expenseSpreads/${spread.id}`);
      setSaveError('Could not delete spread. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (expenseCategories.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        <p className="text-sm font-bold text-gray-600">No expense categories yet</p>
        <p className="text-xs mt-1">Add categories in Settings → Expense Categories first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400">
        Pay once (e.g. annual tax or notary), split evenly across selected months.
      </p>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Spreads in {year}
        </p>
        {yearSpreads.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-1">
            No spreads yet for {year}. Add one below.
          </p>
        ) : (
          <div className="space-y-1.5">
            {yearSpreads.map(spread => {
              const months = Array.isArray(spread.months) ? spread.months : [];
              const share = months.length > 0 ? spreadAmountForMonth(spread, months[0]) : 0;
              return (
                <div
                  key={spread.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                    editingId === spread.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {spreadDisplayName(spread)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {spread.categoryLabel} · {formatCurrency(share)}/mo · {formatSpreadMonthLabel(months)}
                    </p>
                  </div>
                  <span className="text-xs font-black text-gray-900 shrink-0">
                    {formatCurrency(Number(spread.totalAmount) || 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(spread)}
                    disabled={deletingId === spread.id}
                    className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    aria-label={`Edit ${spreadDisplayName(spread)}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(spread)}
                    disabled={deletingId === spread.id}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                    aria-label={`Delete ${spreadDisplayName(spread)}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-gray-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {editingId ? 'Edit spread' : 'Add spread'}
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Company tax"
          className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Category</label>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-black outline-none"
        >
          {expenseCategories.map(c => (
            <option key={c.id} value={c.id}>{expenseSourceLabel(c.name, 'spread')}</option>
          ))}
        </select>
        {selectedCategory && (
          <p className="text-[10px] text-gray-400 mt-1">
            Allocates to each selected month as {expenseSourceLabel(selectedCategory.name, 'spread')}.
          </p>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Total amount</label>
        <div className="relative w-full sm:w-1/2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">€</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={total}
            onChange={e => setTotal(e.target.value)}
            className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-black outline-none"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[10px] font-bold text-gray-400 uppercase">Months</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allMonthsSelected}
              onChange={e => toggleAllMonths(e.target.checked)}
              className="rounded border-gray-300 text-black focus:ring-black w-3.5 h-3.5"
            />
            <span className="text-xs font-bold text-gray-600">All months</span>
          </label>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {yearMonths.map((monthKey, i) => {
            const checked = selectedMonths.includes(monthKey);
            return (
              <label
                key={monthKey}
                className={cn(
                  'flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors',
                  checked ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => toggleMonth(monthKey, e.target.checked)}
                  className="sr-only"
                />
                {MONTH_LABELS[i]}
              </label>
            );
          })}
        </div>
      </div>

      {parsedTotal > 0 && monthCount > 0 && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-700">
            {formatCurrency(perMonth)} per month × {monthCount} {monthCount === 1 ? 'month' : 'months'}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {formatSpreadMonthLabel(selectedMonths)} · total {formatCurrency(parsedTotal)}
          </p>
        </div>
      )}

      {parsedTotal > 0 && monthCount === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          Select at least one month to spread this expense.
        </p>
      )}

      <div>
        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Paid to the accountant in March"
          className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
        />
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl">
          <AlertCircle size={14} />
          <span className="text-xs font-bold">{saveError}</span>
        </div>
      )}

      <div className="pt-2 border-t border-gray-100 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={editingId ? resetForm : onClose}
            className="px-4 py-2.5 bg-white border text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 disabled:opacity-50 ml-auto"
          >
            <Save size={14} />
            {isSaving ? 'Saving…' : editingId ? 'Update spread' : 'Save spread'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpensesRecurringForm({
  expenseCategories,
  recurringExpenses,
  previewYear,
  onClose,
}: {
  expenseCategories: ConfigOption[];
  recurringExpenses: RecurringExpense[];
  previewYear: number;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [active, setActive] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => monthsInYear(previewYear));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const yearMonths = useMemo(() => monthsInYear(previewYear), [previewYear]);
  const monthsOfYear = useMemo(() => monthsOfYearFromKeys(selectedMonths), [selectedMonths]);
  const allMonthsSelected = selectedMonths.length === yearMonths.length
    && yearMonths.every(m => selectedMonths.includes(m));

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategoryId(expenseCategories[0]?.id || '');
    setAmount('');
    setNote('');
    setActive(true);
    setSelectedMonths(yearMonths);
    setSaveError(null);
  };

  const loadItem = (item: RecurringExpense) => {
    setEditingId(item.id);
    setName(item.name);
    setCategoryId(item.categoryId);
    setAmount(String(item.amountPerMonth));
    setNote(item.note || '');
    setActive(item.active);
    setSelectedMonths(monthKeysFromMonthsOfYear(previewYear, item.monthsOfYear));
    setSaveError(null);
  };

  const toggleAllMonths = (checked: boolean) => {
    setSelectedMonths(checked ? yearMonths : []);
  };

  const toggleMonth = (monthKey: string, checked: boolean) => {
    setSelectedMonths(prev => {
      if (checked) return [...prev, monthKey].sort();
      return prev.filter(m => m !== monthKey);
    });
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const selectedCategory = expenseCategories.find(c => c.id === categoryId);
    const parsedAmount = amount.trim() === '' ? NaN : Number(amount);

    if (!trimmedName) {
      setSaveError('Enter a subscription name.');
      return;
    }
    if (!categoryId || !selectedCategory) {
      setSaveError('Select a category.');
      return;
    }
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setSaveError('Enter an amount greater than zero.');
      return;
    }
    if (monthsOfYear.length === 0) {
      setSaveError('Select at least one month.');
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    const now = new Date().toISOString();
    const payload = {
      name: trimmedName,
      categoryId,
      categoryLabel: selectedCategory.name,
      amountPerMonth: parsedAmount,
      active,
      monthsOfYear,
      note: note.trim(),
      updatedAt: now,
      updatedBy: profile?.name || profile?.email || '',
    };

    try {
      if (editingId) {
        await setDoc(doc(db, 'recurringExpenses', editingId), payload);
      } else {
        await addDoc(collection(db, 'recurringExpenses'), payload);
      }
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'recurringExpenses');
      setSaveError('Could not save subscription. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: RecurringExpense) => {
    try {
      await updateDoc(doc(db, 'recurringExpenses', item.id), {
        active: !item.active,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.name || profile?.email || '',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `recurringExpenses/${item.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this subscription?')) return;
    try {
      await deleteDoc(doc(db, 'recurringExpenses', id));
      if (editingId === id) resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `recurringExpenses/${id}`);
    }
  };

  if (expenseCategories.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        <p className="text-sm font-bold text-gray-600">No expense categories yet</p>
        <p className="text-xs mt-1">Add categories in Settings → Expense Categories first.</p>
      </div>
    );
  }

  const parsedAmount = amount.trim() === '' ? 0 : Number(amount);

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400">
        Fixed monthly charges (e.g. ChatGPT, Spotify, internet). Selected months repeat every year.
      </p>

      {recurringExpenses.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Your subscriptions</p>
          {recurringExpenses.map(item => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2 p-3 rounded-xl border',
                editingId === item.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white',
                !item.active && 'opacity-60',
              )}
            >
              <label className="flex items-center gap-2 shrink-0 cursor-pointer" title={item.active ? 'Active' : 'Paused'}>
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={() => handleToggleActive(item)}
                  className="rounded border-gray-300 text-black focus:ring-black w-3.5 h-3.5"
                />
              </label>
              <button
                type="button"
                onClick={() => loadItem(item)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                <p className="text-[10px] text-gray-400">
                  {expenseSourceLabel(item.categoryLabel, 'recurring')} · {formatCurrency(item.amountPerMonth)}/mo · {formatMonthsOfYearLabel(item.monthsOfYear, previewYear)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                aria-label="Delete subscription"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-gray-100 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {editingId ? 'Edit subscription' : 'Add subscription'}
        </p>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. ChatGPT"
            className="w-full px-4 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-black outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Category</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-black outline-none"
            >
              {expenseCategories.map(c => (
                <option key={c.id} value={c.id}>{expenseSourceLabel(c.name, 'recurring')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Amount / month</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">€</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-black outline-none"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase">Months</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allMonthsSelected}
                onChange={e => toggleAllMonths(e.target.checked)}
                className="rounded border-gray-300 text-black focus:ring-black w-3.5 h-3.5"
              />
              <span className="text-xs font-bold text-gray-600">All months</span>
            </label>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {yearMonths.map((monthKey, i) => {
              const checked = selectedMonths.includes(monthKey);
              return (
                <label
                  key={monthKey}
                  className={cn(
                    'flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors',
                    checked ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => toggleMonth(monthKey, e.target.checked)}
                    className="sr-only"
                  />
                  {MONTH_LABELS[i]}
                </label>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Preview for {previewYear} · repeats every year in selected months
          </p>
        </div>

        {parsedAmount > 0 && monthsOfYear.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs font-bold text-gray-700">
              {formatCurrency(parsedAmount)} per month in {formatMonthsOfYearLabel(monthsOfYear, previewYear)}
            </p>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Personal subscription"
            className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-black outline-none"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            className="rounded border-gray-300 text-black focus:ring-black w-3.5 h-3.5"
          />
          <span className="text-xs font-bold text-gray-600">Active (included in monthly totals)</span>
        </label>

        {saveError && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl">
            <AlertCircle size={14} />
            <span className="text-xs font-bold">{saveError}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2.5 bg-white border text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {editingId && (
            <button
              type="button"
              disabled={isSaving}
              onClick={resetForm}
              className="px-4 py-2.5 bg-white border text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
            >
              New
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 disabled:opacity-50 ml-auto"
          >
            <Save size={14} />
            {isSaving ? 'Saving…' : editingId ? 'Update subscription' : 'Save subscription'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const SUMMARY_TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'expenses', label: 'Expenses' },
];

const SEGMENT_TABS: { id: Tab; label: string }[] = [
  { id: 'retreats', label: 'Retreats' },
  { id: 'coliving', label: 'Coliving' },
  { id: 'venue', label: 'Venue Hire' },
  { id: 'exchange', label: 'Home Exchange' },
];

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Finances view error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[200] bg-gray-50 flex flex-col pt-safe pb-safe px-safe">
          <header className="h-14 bg-white border-b px-4 sm:px-8 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">Finances</h2>
            <button onClick={this.props.onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
              <X size={20} />
            </button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
            <AlertCircle size={32} className="text-rose-500 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Could not load this month</h3>
            <p className="text-sm text-gray-500 mb-4">
              Something in this month&apos;s data could not be displayed. Your bookings are safe. Try another month, or check the browser console for details.
            </p>
            <p className="text-xs text-rose-600 font-mono bg-rose-50 rounded-lg p-3 mb-6 break-all">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DashboardModal(props: DashboardModalProps) {
  if (!props.isOpen) return null;
  return (
    <DashboardErrorBoundary onClose={props.onClose}>
      <DashboardModalContent {...props} />
    </DashboardErrorBoundary>
  );
}

function DashboardModalContent({
  onClose, bookings, venueHires, rooms, bookingChannels, paymentChannels,
}: DashboardModalProps) {
  const { expenseCategories, monthlyExpenses, expenseSpreads, recurringExpenses, settings, bookingTypes } = useBooking();
  const { isAdmin, profile } = useAuth();
  const now = new Date();
  const [tab, setTab] = useState<Tab>('overview');
  const [isExpenseEntryOpen, setIsExpenseEntryOpen] = useState(false);
  const [manageYear, setManageYear] = useState(now.getFullYear());
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingVenueHire, setEditingVenueHire] = useState<VenueHire | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isVenueHireModalOpen, setIsVenueHireModalOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('Month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [dateRange, setDateRange] = useState(() => monthRange(now.getFullYear(), now.getMonth()));

  const selectMonth = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setDateRange(monthRange(year, month));
    setPeriod('Month');
  };

  const periodRange = useMemo(() => {
    if (period === 'All') return null;
    if (dateRange.from && dateRange.to) {
      return {
        start: startOfDay(parseISO(dateRange.from)),
        end: endOfDay(parseISO(dateRange.to)),
      };
    }
    const fallback = monthRange(selectedYear, selectedMonth);
    return {
      start: startOfDay(parseISO(fallback.from)),
      end: endOfDay(parseISO(fallback.to)),
    };
  }, [period, dateRange, selectedYear, selectedMonth]);

  const isMonthView = period !== 'All';
  const monthKey = useMemo(
    () => (isMonthView ? monthKeyFromRange(periodRange) : null),
    [isMonthView, periodRange],
  );

  const currentMonthlyExpense = useMemo(
    () => (monthKey ? monthlyExpenses.find(e => e.month === monthKey || e.id === monthKey) : undefined),
    [monthKey, monthlyExpenses],
  );

  const recurringByCategory = useMemo(
    () => (monthKey ? getRecurringAmountsForMonth(monthKey, recurringExpenses) : {}),
    [monthKey, recurringExpenses],
  );

  const spreadByCategory = useMemo(
    () => (monthKey ? getSpreadAmountsForMonth(monthKey, expenseSpreads) : {}),
    [monthKey, expenseSpreads],
  );

  const totalExpenses = useMemo(
    () => sumMonthlyExpenseTotal(currentMonthlyExpense, recurringByCategory, spreadByCategory),
    [currentMonthlyExpense, recurringByCategory, spreadByCategory],
  );

  const openExpenseEntry = () => {
    setManageYear(selectedYear);
    setIsExpenseEntryOpen(true);
  };

  const handleExpenseSaved = () => {
    setIsExpenseEntryOpen(false);
    setTab('expenses');
  };

  const handleOpenOutstanding = (item: OutstandingItem) => {
    if (item.isVenueHire) {
      const vh = venueHires.find(v => v.id === item.id);
      if (!vh) return;
      setEditingVenueHire(vh);
      setIsVenueHireModalOpen(true);
      return;
    }
    const booking = bookings.find(b => b.id === item.id);
    if (!booking) return;
    setEditingBooking(booking);
    setIsBookingModalOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] bg-gray-50 flex flex-col pt-safe pb-safe px-safe"
    >
          {/* Header */}
          <header className="h-14 bg-white border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
                <DollarSign size={16} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Finances</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
              <X size={20} />
            </button>
          </header>

          {/* Period filter — mobile stacked layout */}
          <div className="bg-white border-b px-4 py-3 shrink-0 sm:hidden">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-gray-400">Period</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPeriod('All')}
                  className={cn(
                    FILTER_CTRL,
                    'transition-all shrink-0 inline-flex items-center',
                    period === 'All'
                      ? 'bg-black text-white border-black'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  All
                </button>
                <div className="flex items-center h-7 gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const y = selectedYear - 1;
                      setSelectedYear(y);
                      if (period === 'Month') selectMonth(y, selectedMonth);
                    }}
                    className="h-7 w-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold px-1 min-w-[36px] text-center leading-none">{selectedYear}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const y = selectedYear + 1;
                      setSelectedYear(y);
                      if (period === 'Month') selectMonth(y, selectedMonth);
                    }}
                    className="h-7 w-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-0.5">
                {MONTH_LABELS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectMonth(selectedYear, i)}
                    className={cn(
                      'h-7 px-1 inline-flex items-center justify-center rounded-lg text-[10px] font-bold transition-all',
                      period === 'Month' && isFullMonthRange(dateRange.from, dateRange.to, selectedYear, i)
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex items-center h-7 gap-1 bg-white border border-gray-200 px-1.5 rounded-lg shadow-sm w-full">
                <DatePicker
                  compact
                  value={dateRange.from}
                  onChange={val => {
                    setPeriod('Month');
                    setDateRange(prev => ({
                      ...prev,
                      from: val,
                      to: (prev.to && val >= prev.to) ? '' : prev.to,
                    }));
                  }}
                  className="flex-1 min-w-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none [&>div]:focus-within:ring-0"
                />
                <span className="text-gray-300 text-[10px] shrink-0">→</span>
                <DatePicker
                  compact
                  value={dateRange.to}
                  min={dateRange.from ? new Date(new Date(dateRange.from).getTime() + 86400000).toISOString().split('T')[0] : ''}
                  onChange={val => {
                    setPeriod('Month');
                    setDateRange(prev => ({ ...prev, to: val }));
                  }}
                  className="flex-1 min-w-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none [&>div]:focus-within:ring-0"
                />
              </div>
            </div>
          </div>

          {/* Period filter — desktop layout (unchanged) */}
          <div className="hidden sm:block bg-white border-b px-4 sm:px-8 py-3 shrink-0">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-gray-400">Period</span>
              <div className="flex flex-wrap items-center gap-2 min-h-7">
                <button
                  type="button"
                  onClick={() => setPeriod('All')}
                  className={cn(
                    FILTER_CTRL,
                    'transition-all shrink-0 inline-flex items-center',
                    period === 'All'
                      ? 'bg-black text-white border-black'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  All
                </button>

                <div className="flex items-center h-7 gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const y = selectedYear - 1;
                      setSelectedYear(y);
                      if (period === 'Month') selectMonth(y, selectedMonth);
                    }}
                    className="h-7 w-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold px-1 min-w-[36px] text-center leading-none">{selectedYear}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const y = selectedYear + 1;
                      setSelectedYear(y);
                      if (period === 'Month') selectMonth(y, selectedMonth);
                    }}
                    className="h-7 w-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-0.5 min-w-0">
                  {MONTH_LABELS.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => selectMonth(selectedYear, i)}
                      className={cn(
                        'h-7 px-2 inline-flex items-center rounded-lg text-[11px] font-bold transition-all',
                        period === 'Month' && isFullMonthRange(dateRange.from, dateRange.to, selectedYear, i)
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="flex items-center h-7 gap-1 bg-white border border-gray-200 px-1.5 rounded-lg shadow-sm shrink-0">
                  <DatePicker
                    compact
                    value={dateRange.from}
                    onChange={val => {
                      setPeriod('Month');
                      setDateRange(prev => ({
                        ...prev,
                        from: val,
                        to: (prev.to && val >= prev.to) ? '' : prev.to,
                      }));
                    }}
                    className="w-[88px] [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none [&>div]:focus-within:ring-0"
                  />
                  <span className="text-gray-300 text-[10px]">→</span>
                  <DatePicker
                    compact
                    value={dateRange.to}
                    min={dateRange.from ? new Date(new Date(dateRange.from).getTime() + 86400000).toISOString().split('T')[0] : ''}
                    onChange={val => {
                      setPeriod('Month');
                      setDateRange(prev => ({ ...prev, to: val }));
                    }}
                    className="w-[88px] [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none [&>div]:focus-within:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b shrink-0">
            <div className="flex items-center px-4 sm:px-8 gap-3 min-h-[45px]">
              <div className="flex items-center overflow-x-auto min-w-0 flex-1">
                {SUMMARY_TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => startTransition(() => setTab(t.id))}
                    className={cn(
                      'px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all',
                      tab === t.id
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-700'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
                <span className="w-px h-5 bg-gray-300 mx-3 shrink-0" aria-hidden="true" />
                {SEGMENT_TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => startTransition(() => setTab(t.id))}
                    className={cn(
                      'px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all',
                      tab === t.id
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-700'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="shrink-0 pl-2 sm:pl-3 ml-auto sm:ml-1 sm:border-l sm:border-gray-200">
                <button
                  type="button"
                  onClick={openExpenseEntry}
                  disabled={expenseCategories.length === 0}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
                    'bg-black text-white border-black shadow-sm hover:bg-gray-800',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Receipt size={14} />
                  Manage expenses
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-5xl mx-auto w-full">
            {tab === 'expenses' ? (
              <ExpensesReportSection
                monthKey={monthKey}
                expenseCategories={expenseCategories}
                monthlyExpense={currentMonthlyExpense}
                expenseSpreads={expenseSpreads}
                recurringExpenses={recurringExpenses}
              />
            ) : (
              <StatsTabContent
                tab={tab}
                bookings={bookings}
                venueHires={venueHires}
                rooms={rooms}
                bookingChannels={bookingChannels}
                paymentChannels={paymentChannels}
                periodRange={periodRange}
                totalExpenses={totalExpenses}
                isMonthView={isMonthView}
                onOpenOutstanding={handleOpenOutstanding}
              />
            )}
          </main>

          {isExpenseEntryOpen && (
            <Modal
              isOpen
              onClose={() => setIsExpenseEntryOpen(false)}
              title="Manage expenses"
              elevated
            >
              <ExpensesEntryPanel
                year={manageYear}
                onYearChange={setManageYear}
                expenseCategories={expenseCategories}
                monthlyExpenses={monthlyExpenses}
                expenseSpreads={expenseSpreads}
                recurringExpenses={recurringExpenses}
                onSaved={handleExpenseSaved}
                onClose={() => setIsExpenseEntryOpen(false)}
              />
            </Modal>
          )}

          {isBookingModalOpen && (
            <BookingModal
              isOpen
              onClose={() => {
                setIsBookingModalOpen(false);
                setEditingBooking(null);
              }}
              booking={editingBooking}
              rooms={rooms}
              bookings={bookings}
              venueHires={venueHires}
              settings={settings}
              bookingTypes={bookingTypes}
              bookingChannels={bookingChannels}
              paymentChannels={paymentChannels}
              isAdmin={isAdmin}
              currentUserName={profile?.name}
              currentUserEmail={profile?.email}
              elevated
            />
          )}

          {isVenueHireModalOpen && (
            <VenueHireModal
              isOpen
              onClose={() => {
                setIsVenueHireModalOpen(false);
                setEditingVenueHire(null);
              }}
              venueHire={editingVenueHire}
              rooms={rooms}
              bookingChannels={bookingChannels}
              paymentChannels={paymentChannels}
              currentUserName={profile?.name}
              currentUserEmail={profile?.email}
              elevated
            />
          )}
        </motion.div>
  );
}
