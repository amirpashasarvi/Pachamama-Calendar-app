import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, TrendingUp, Wallet, Clock, ArrowUpRight, Users, LayoutDashboard } from 'lucide-react';
import { Booking, VenueHire, Room, ConfigOption } from '@/types';
import { useDashboardStats, DashboardPeriod, UpcomingItem } from '@/hooks/useDashboardStats';
import { cn, formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  venueHires: VenueHire[];
  rooms: Room[];
  bookingChannels: ConfigOption[];
}

type Tab = 'overview' | 'retreats' | 'coliving' | 'venue' | 'exchange';

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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 font-bold">{label}</span>
      <span className="text-xs font-black text-gray-900">{value}</span>
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
                <span className="text-xs font-bold text-gray-700">{format(parseISO(item.checkIn), 'dd MMM')}</span>
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

// ── Tab sections ──────────────────────────────────────────────────────────────

function OverviewSection({ stats }: { stats: ReturnType<typeof useDashboardStats> }) {
  const g = stats.global;
  const maxTypeRevenue = g.revenueByType[0]?.revenue ?? 1;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={formatCurrency(g.totalRevenue)} tone="default" />
        <StatCard label="Collected" value={formatCurrency(g.totalCollected)} tone="green" />
        <StatCard label="Outstanding" value={formatCurrency(g.totalOutstanding)} tone="amber" sub={`${g.unpaidCount} unpaid bookings`} />
        <StatCard label="Future Expected" value={formatCurrency(g.futureOutstanding)} tone="blue" sub="Balance due on upcoming" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="pt-3 mt-3 border-t border-gray-100">
            <MetricRow label="Channel commissions" value={formatCurrency(g.totalCommissions)} />
            <MetricRow label="Total bookings" value={String(g.bookingCount)} />
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

// ── Main modal ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'retreats', label: 'Retreats' },
  { id: 'coliving', label: 'Coliving' },
  { id: 'venue', label: 'Venue Hire' },
  { id: 'exchange', label: 'Home Exchange' },
];

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '90d', label: '90 days' },
  { id: '12m', label: '12 months' },
  { id: 'upcoming', label: 'Upcoming' },
];

export default function DashboardModal({
  isOpen, onClose, bookings, venueHires, rooms, bookingChannels,
}: DashboardModalProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<DashboardPeriod>('all');

  const stats = useDashboardStats(bookings, venueHires, rooms, bookingChannels, period);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-gray-50 flex flex-col"
        >
          {/* Header */}
          <header className="h-14 bg-white border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
                <LayoutDashboard size={16} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Business Dashboard</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
              <X size={22} />
            </button>
          </header>

          {/* Period filter */}
          <div className="bg-white border-b px-4 sm:px-8 py-2 flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-gray-400 shrink-0">Period:</span>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                    period === p.id ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b shrink-0 overflow-x-auto">
            <div className="flex px-4 sm:px-8 min-w-max">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
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
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-5xl mx-auto w-full">
            {tab === 'overview'  && <OverviewSection stats={stats} />}
            {tab === 'retreats'  && <RetreatsSection stats={stats} />}
            {tab === 'coliving'  && <ColivingSection stats={stats} />}
            {tab === 'venue'     && <VenueHireSection stats={stats} />}
            {tab === 'exchange'  && <HomeExchangeSection stats={stats} />}
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
