import React, { useState, useMemo } from 'react';
import { X, Download, Search, List, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from '@/components/ui/DatePicker';
import BookingModal from '@/components/modals/BookingModal';
import VenueHireModal from '@/components/modals/VenueHireModal';
import { Booking, Room, ConfigOption, VenueHire } from '@/types';
import { useBooking } from '@/hooks/useBooking';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { stayOverlapsPeriod } from '@/lib/prorate';
import { getCollectedAmount } from '@/lib/bookingFinancials';
import {
  resolveReportingFinancials,
  isCancelledLifecycle,
  checkInInPeriod,
} from '@/lib/bookingLifecycle';
import { MONTH_LABELS, FILTER_CTRL, monthRange, isFullMonthRange } from '@/lib/reportPeriod';
import { exportBookingsToCSV, exportVenueHiresToCSV, exportFinancialSummaryToCSV } from '@/lib/exportUtils';
import { 
  format, 
  subMonths, 
  startOfDay, 
  endOfDay,
  startOfMonth,
  endOfMonth,
  parseISO, 
} from 'date-fns';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  venueHires?: VenueHire[];
  rooms: Room[];
  bookingChannels: ConfigOption[];
  paymentChannels: ConfigOption[];
}

type Period = 'All' | 'Month';

export default function StatisticsModal({ isOpen, onClose, bookings, venueHires = [], rooms, bookingChannels, paymentChannels }: StatisticsModalProps) {
  const { settings, bookingTypes } = useBooking();
  const { isAdmin, profile } = useAuth();

  const now = new Date();
  const [period, setPeriod] = useState<Period>('Month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'checkIn' | 'createdAt'>('checkIn');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState(() => monthRange(now.getFullYear(), now.getMonth()));

  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'cancelled'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'website' | 'direct'>('all');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingVenueHire, setEditingVenueHire] = useState<VenueHire | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isVenueHireModalOpen, setIsVenueHireModalOpen] = useState(false);

  const handleEditItem = (item: { id: string; isVenueHire: boolean }) => {
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

  const combinedItems = useMemo(() => {
    const mappedBookings = bookings
      .filter(b => b.type?.toLowerCase() !== 'blocked')
      .map(b => ({
      ...b,
      isVenueHire: false,
      type: b.type || 'Other',
      lifecycleStatus: b.lifecycleStatus,
      financials: {
        price: b.price || 0,
        deposit: b.deposit || 0,
        payments: b.payments,
        paidLater1: b.paidLater1 || 0,
        paidLater2: b.paidLater2 || 0,
        extras: b.extras || []
      }
    }));

    const mappedVenueHires = venueHires.map(vh => ({
      id: vh.id,
      guestName: vh.organizer,
      checkIn: vh.startDate,
      checkOut: vh.endDate,
      bookingChannel: vh.bookingChannel,
      paymentChannel: vh.paymentChannel,
      channelPaymentBasis: vh.channelPaymentBasis,
      commissionCustomAmount: vh.commissionCustomAmount,
      createdAt: vh.createdAt,
      lifecycleStatus: vh.lifecycleStatus,
      isVenueHire: true,
      type: 'Venue Hire',
      roomId: 'venue-hire',
      financials: {
        price: vh.bookingPrice || 0,
        deposit: vh.deposit || 0,
        paidLater1: vh.paidLater1 || 0,
        paidLater2: vh.paidLater2 || 0,
        extras: vh.extras || []
      }
    }));

    return [...mappedBookings, ...mappedVenueHires];
  }, [bookings, venueHires]);

  const selectMonth = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setDateRange(monthRange(year, month));
    setPeriod('Month');
  };

  const { startDate, endDate, filteredItems } = useMemo(() => {
    let start: Date;
    let end: Date;

    if (period === 'All') {
      const allCheckIns = combinedItems.map(b => parseISO(b.checkIn)).filter(d => !isNaN(d.getTime()));
      const allCheckOuts = combinedItems.map(b => parseISO(b.checkOut)).filter(d => !isNaN(d.getTime()));
      
      start = allCheckIns.length > 0 ? startOfDay(new Date(Math.min(...allCheckIns.map(d => d.getTime())))) : startOfDay(subMonths(new Date(), 1));
      end = allCheckOuts.length > 0 ? endOfDay(new Date(Math.max(...allCheckOuts.map(d => d.getTime())))) : endOfDay(new Date());
    } else if (dateRange.from && dateRange.to) {
      start = startOfDay(parseISO(dateRange.from));
      end = endOfDay(parseISO(dateRange.to));
    } else {
      const fallback = monthRange(selectedYear, selectedMonth);
      start = startOfDay(parseISO(fallback.from));
      end = endOfDay(parseISO(fallback.to));
    }

    const filtered = combinedItems.filter(b => {
      const matchesRoom = roomFilter === 'all' || b.roomId === roomFilter;
      if (!matchesRoom) return false;

      const cancelled = isCancelledLifecycle(b);

      if (cancelled) {
        if (period === 'All') return true;
        return checkInInPeriod(b.checkIn, start, end);
      }

      if (period === 'All') return true;
      return stayOverlapsPeriod(b.checkIn, b.checkOut, start, end);
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'checkIn') {
        return parseISO(a.checkIn).getTime() - parseISO(b.checkIn).getTime();
      } else {
        const dateA = a.createdAt ? parseISO(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? parseISO(b.createdAt).getTime() : 0;
        return dateB - dateA; // Descending for Added Date
      }
    });

    return { startDate: start, endDate: end, filteredItems: sorted };
  }, [period, roomFilter, sortBy, dateRange, combinedItems, selectedYear, selectedMonth]);

  const periodRange = useMemo(
    () => ({ start: startDate, end: endDate }),
    [startDate, endDate]
  );

  const searchedItems = useMemo(() => {
    let result = filteredItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(b => b.guestName.toLowerCase().includes(query));
    }

    if (statusFilter !== 'all') {
      result = result.filter(b => {
        const cancelled = isCancelledLifecycle(b);
        if (statusFilter === 'cancelled') return cancelled;

        if (cancelled) return false;
        const total = b.financials.price + (b.financials.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
        const paid = getCollectedAmount(b.financials);
        const remaining = total - paid;
        if (statusFilter === 'paid') return remaining === 0 && total > 0;
        if (statusFilter === 'partial') return remaining > 0 && paid > 0;
        if (statusFilter === 'unpaid') return paid === 0 && total > 0;
        return true;
      });
    }

    if (sourceFilter === 'website') {
      result = result.filter(b => !b.isVenueHire && (b as Booking).source === 'booking-site');
    } else if (sourceFilter === 'direct') {
      result = result.filter(b => b.isVenueHire || (b as Booking).source !== 'booking-site');
    }

    return result;
  }, [filteredItems, searchQuery, statusFilter, sourceFilter]);

  const listTotals = useMemo(() => {
    let total = 0;
    let paid = 0;

    searchedItems.forEach(b => {
      const amounts = resolveReportingFinancials(
        b.checkIn,
        b.checkOut,
        periodRange,
        b.financials,
        b.lifecycleStatus
      );
      total += amounts.revenue;
      paid += amounts.collected;
    });

    return { total, paid, remaining: total - paid };
  }, [searchedItems, periodRange]);

  const sourceCounts = useMemo(() => {
    const bookingItems = filteredItems.filter(b => !b.isVenueHire) as (typeof filteredItems[0] & Booking)[];
    const website = bookingItems.filter(b => b.source === 'booking-site').length;
    return { website, direct: bookingItems.length - website };
  }, [filteredItems]);

  const handleExportBookings = () => {
    const ids = new Set(filteredItems.filter(i => !i.isVenueHire).map(i => i.id));
    exportBookingsToCSV(bookings.filter(b => ids.has(b.id)), rooms, bookingChannels, paymentChannels, periodRange);
  };

  const handleExportVenueHires = () => {
    const ids = new Set(filteredItems.filter(i => i.isVenueHire).map(i => i.id));
    exportVenueHiresToCSV(venueHires.filter(v => ids.has(v.id)), bookingChannels, paymentChannels, periodRange);
  };

  const handleExportFinancial = () => {
    const bookingIds = new Set(filteredItems.filter(i => !i.isVenueHire).map(i => i.id));
    const venueIds = new Set(filteredItems.filter(i => i.isVenueHire).map(i => i.id));
    exportFinancialSummaryToCSV(
      bookings.filter(b => bookingIds.has(b.id)),
      venueHires.filter(v => venueIds.has(v.id)),
      rooms,
      bookingChannels,
      paymentChannels,
      periodRange
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-gray-50 flex flex-col pt-safe pb-safe px-safe"
        >
          {/* Header */}
          <header className="h-14 bg-white border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
                <List size={16} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Bookings</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={20} />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
            {/* Filters — mobile stacked layout */}
            <div className="flex flex-col gap-3 pb-2 sm:hidden">
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
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-400">Room Filter</span>
                <select
                  value={roomFilter}
                  onChange={e => setRoomFilter(e.target.value)}
                  className={cn(FILTER_CTRL, 'outline-none cursor-pointer hover:border-gray-300 transition-colors w-full')}
                >
                  <option value="all">All Rooms</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filters — desktop layout (unchanged) */}
            <div className="hidden sm:flex flex-wrap items-end gap-x-6 gap-y-3 pb-2">
              <div className="flex flex-col gap-2 flex-1 min-w-0">
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

              <div className="flex flex-col gap-2 shrink-0">
                <span className="text-xs font-bold text-gray-400">Room Filter</span>
                <select
                  value={roomFilter}
                  onChange={e => setRoomFilter(e.target.value)}
                  className={cn(FILTER_CTRL, 'outline-none cursor-pointer hover:border-gray-300 transition-colors min-w-[120px]')}
                >
                  <option value="all">All Rooms</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-0 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSourceFilter('all')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors',
                    sourceFilter === 'all' ? 'bg-black text-white border-black' : 'text-gray-500 border-gray-200 hover:border-gray-300',
                  )}
                >
                  All sources
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter('website')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors',
                    sourceFilter === 'website' ? 'bg-sky-600 text-white border-sky-600' : 'text-gray-500 border-gray-200 hover:border-gray-300',
                  )}
                >
                  Website ({sourceCounts.website})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter('direct')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors',
                    sourceFilter === 'direct' ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:border-gray-300',
                  )}
                >
                  Direct / manual ({sourceCounts.direct})
                </button>
              </div>
              <div className="p-6 border-b flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Bookings Detail</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500">
                      <Search size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Search guest name..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-gray-50 border rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-black transition-all w-48"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="px-3 py-1.5 bg-gray-50 border rounded-xl text-[11px] font-bold outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <option value="all">All</option>
                      <option value="paid">Paid</option>
                      <option value="partial">Partial</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="px-3 py-1.5 bg-gray-50 border rounded-xl text-[11px] font-bold outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <option value="checkIn">Check-in Date</option>
                      <option value="createdAt">Added Date</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleExportBookings}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-colors"
                      title="Export bookings for the selected period to CSV"
                    >
                      <Download size={12} /> Bookings
                    </button>
                    <button
                      onClick={handleExportVenueHires}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-colors"
                      title="Export venue hires for the selected period to CSV"
                    >
                      <Download size={12} /> Venue Hires
                    </button>
                    <button
                      onClick={handleExportFinancial}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-colors"
                      title="Export combined financial summary to CSV"
                    >
                      <Download size={12} /> Financial
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Guest</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Room</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Dates</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Paid</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Remaining</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {searchedItems.map(b => {
                      const cancelled = isCancelledLifecycle(b);
                      const amounts = resolveReportingFinancials(
                        b.checkIn,
                        b.checkOut,
                        periodRange,
                        b.financials,
                        b.lifecycleStatus
                      );
                      const fullTotal = b.financials.price + (b.financials.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
                      const paid = amounts.collected;
                      const remaining = cancelled ? 0 : Math.max(0, fullTotal - paid);

                      const roomName = b.isVenueHire 
                        ? <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-black uppercase whitespace-nowrap">Venue Hire</span>
                        : rooms.find(r => r.id === b.roomId)?.name || 'Unknown';

                      return (
                        <tr key={b.id} className={cn('group hover:bg-gray-50/80 transition-colors', cancelled && 'bg-rose-50/40')}>
                          <td className="px-6 py-4">
                            <div className={cn('text-sm font-bold', cancelled ? 'text-rose-700' : 'text-gray-900')}>{b.guestName}</div>
                            {!b.isVenueHire && b.type && (
                              <span className={cn('text-[9px] font-black uppercase tracking-wider', cancelled ? 'text-rose-500' : 'text-gray-400')}>{b.type}</span>
                            )}
                            {!b.isVenueHire && (b as Booking).source === 'booking-site' && (
                              <span className="ml-1 px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[8px] font-black uppercase">Website</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn('text-xs font-bold whitespace-nowrap', cancelled ? 'text-rose-600' : 'text-gray-500')}>{roomName}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={cn('text-[10px] font-black', cancelled ? 'text-rose-700' : 'text-gray-900')}>{format(parseISO(b.checkIn), 'dd MMM')}</span>
                              <span className={cn('text-[9px] font-bold', cancelled ? 'text-rose-400' : 'text-gray-400')}>to</span>
                              <span className={cn('text-[10px] font-black', cancelled ? 'text-rose-700' : 'text-gray-900')}>{format(parseISO(b.checkOut), 'dd MMM')}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={cn('text-xs font-black', cancelled ? 'text-rose-700' : '')}>€{amounts.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={cn('text-xs font-bold', cancelled ? 'text-rose-600' : 'text-gray-600')}>€{paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {remaining > 0 ? (
                              <span className="text-xs font-black text-amber-600">€{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            ) : (
                              <span className={cn('text-xs font-bold', cancelled ? 'text-rose-400' : 'text-green-600')}>—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {cancelled ? (
                              <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md text-[10px] font-black uppercase">Cancelled</span>
                            ) : remaining === 0 && fullTotal > 0 ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-[10px] font-black uppercase">Paid</span>
                            ) : paid > 0 ? (
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-black uppercase">Partial</span>
                            ) : (
                              <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md text-[10px] font-black uppercase">Unpaid</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditItem(b)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-100">
                      <td colSpan={3} className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-900">
                        Visible Totals
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-base font-black text-gray-900 tabular-nums">
                          €{listTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-base font-black text-gray-700 tabular-nums">
                          €{listTotals.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={cn(
                          'text-base font-black tabular-nums',
                          listTotals.remaining > 0 ? 'text-amber-700' : 'text-green-700'
                        )}>
                          {listTotals.remaining > 0
                            ? `€${listTotals.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </span>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {searchedItems.length === 0 && (
                <div className="p-12 text-center text-gray-400 italic text-sm">
                  No records found for the selected criteria
                </div>
              )}
            </div>
          </main>

          <BookingModal
            isOpen={isBookingModalOpen}
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

          <VenueHireModal
            isOpen={isVenueHireModalOpen}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
