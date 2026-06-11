import React, { useState, useMemo } from 'react';
import { X, Download, Search, List, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from '@/components/ui/DatePicker';
import BookingModal from '@/components/modals/BookingModal';
import VenueHireModal from '@/components/modals/VenueHireModal';
import { Booking, Room, ConfigOption, VenueHire } from '@/types';
import { useBooking } from '@/hooks/useBooking';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { stayOverlapsPeriod } from '@/lib/prorate';
import {
  resolveReportingFinancials,
  isCancelledLifecycle,
  checkInInPeriod,
} from '@/lib/bookingLifecycle';
import { exportBookingsToCSV, exportVenueHiresToCSV, exportFinancialSummaryToCSV } from '@/lib/exportUtils';
import { 
  format, 
  subMonths, 
  startOfDay, 
  endOfDay, 
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

type Period = 'All' | '1M' | '3M' | '6M' | '12M' | 'Custom';

export default function StatisticsModal({ isOpen, onClose, bookings, venueHires = [], rooms, bookingChannels, paymentChannels }: StatisticsModalProps) {
  const { settings, bookingTypes } = useBooking();
  const { isAdmin, profile } = useAuth();

  const [period, setPeriod] = useState<Period>('1M');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'checkIn' | 'createdAt'>('checkIn');
  const [searchQuery, setSearchQuery] = useState('');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({
    from: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [showCancelled, setShowCancelled] = useState(false);
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
    const mappedBookings = bookings.map(b => ({
      ...b,
      isVenueHire: false,
      type: b.type || 'Other',
      lifecycleStatus: b.lifecycleStatus,
      financials: {
        price: b.price || 0,
        deposit: b.deposit || 0,
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

  const { startDate, endDate, filteredItems } = useMemo(() => {
    let start: Date;
    let end = endOfDay(new Date());

    if (period === 'All') {
      const allCheckIns = combinedItems.map(b => parseISO(b.checkIn)).filter(d => !isNaN(d.getTime()));
      const allCheckOuts = combinedItems.map(b => parseISO(b.checkOut)).filter(d => !isNaN(d.getTime()));
      
      start = allCheckIns.length > 0 ? startOfDay(new Date(Math.min(...allCheckIns.map(d => d.getTime())))) : startOfDay(subMonths(new Date(), 1));
      end = allCheckOuts.length > 0 ? endOfDay(new Date(Math.max(...allCheckOuts.map(d => d.getTime())))) : endOfDay(new Date());
    } else if (period === 'Custom') {
      start = startOfDay(parseISO(customRange.from));
      end = endOfDay(parseISO(customRange.to));
    } else {
      const months = parseInt(period);
      start = startOfDay(subMonths(new Date(), months));
    }

    const filtered = combinedItems.filter(b => {
      const matchesRoom = roomFilter === 'all' || b.roomId === roomFilter;
      if (!matchesRoom) return false;

      const cancelled = isCancelledLifecycle(b);

      if (period === 'All') {
        if (cancelled) return showCancelled;
        return true;
      }

      if (cancelled) {
        if (!showCancelled) return false;
        return checkInInPeriod(b.checkIn, start, end);
      }

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
  }, [period, roomFilter, sortBy, customRange, combinedItems, showCancelled]);

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
        if (isCancelledLifecycle(b)) return false;
        const total = b.financials.price + (b.financials.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
        const paid = b.financials.deposit + b.financials.paidLater1 + b.financials.paidLater2;
        const remaining = total - paid;
        if (statusFilter === 'paid') return remaining === 0 && total > 0;
        if (statusFilter === 'partial') return remaining > 0 && paid > 0;
        if (statusFilter === 'unpaid') return paid === 0 && total > 0;
        return true;
      });
    }

    return result;
  }, [filteredItems, searchQuery, statusFilter]);

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
          className="fixed inset-0 z-[200] bg-gray-50 flex flex-col"
        >
          {/* Header */}
          <header className="h-14 bg-white border-b px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg">
                <List size={16} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Booking List</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={24} />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-6 pb-2">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-400">Period</span>
                <div className="flex p-1 bg-white border rounded-xl shadow-sm">
                  {(['All', '1M', '3M', '6M', '12M', 'Custom'] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                        period === p 
                          ? "bg-black text-white shadow-md" 
                          : "text-gray-500 hover:text-gray-900"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {period === 'Custom' && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                  <span className="text-xs font-bold text-gray-400">Custom Dates</span>
                  <div className="flex items-center gap-2 bg-white border p-1 rounded-xl shadow-sm">
                    <DatePicker 
                      value={customRange.from}
                      onChange={val => {
                        setCustomRange(prev => ({
                          ...prev,
                          from: val,
                          to: (prev.to && val >= prev.to) ? '' : prev.to
                        }));
                      }}
                      className="border-none bg-transparent h-auto p-0 focus-within:ring-0"
                    />
                    <span className="text-gray-300">→</span>
                    <DatePicker 
                      value={customRange.to}
                      min={customRange.from ? new Date(new Date(customRange.from).getTime() + 86400000).toISOString().split('T')[0] : ''}
                      onChange={val => setCustomRange(prev => ({ ...prev, to: val }))}
                      className="border-none bg-transparent h-auto p-0 focus-within:ring-0"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-400">Room Filter</span>
                <select
                  value={roomFilter}
                  onChange={e => setRoomFilter(e.target.value)}
                  className="px-4 py-2 bg-white border rounded-xl shadow-sm text-xs font-bold outline-none cursor-pointer hover:border-gray-300 transition-colors"
                >
                  <option value="all">All Rooms</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-400">Cancelled</span>
                <button
                  type="button"
                  onClick={() => setShowCancelled(v => !v)}
                  className={cn(
                    'px-4 py-2 border rounded-xl shadow-sm text-xs font-bold transition-colors',
                    showCancelled
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300'
                  )}
                >
                  {showCancelled ? 'Showing cancelled' : 'Show cancelled'}
                </button>
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
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
                      className="pl-9 pr-4 py-1.5 bg-gray-50 border rounded-xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all w-48"
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
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
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
                        <tr key={b.id} className={cn('group hover:bg-gray-50/80 transition-colors', cancelled && 'opacity-75')}>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-900">{b.guestName}</div>
                            {!b.isVenueHire && b.type && (
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{b.type}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{roomName}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-black text-gray-900">{format(parseISO(b.checkIn), 'dd MMM')}</span>
                              <span className="text-[9px] font-bold text-gray-400">to</span>
                              <span className="text-[10px] font-black text-gray-900">{format(parseISO(b.checkOut), 'dd MMM')}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-black">€{amounts.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-bold text-gray-600">€{paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {remaining > 0 ? (
                              <span className="text-xs font-black text-amber-600">€{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            ) : (
                              <span className="text-xs font-bold text-green-600">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {cancelled ? (
                              <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded-md text-[10px] font-black uppercase">Cancelled</span>
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
                    <tr className="bg-gray-50/80 font-black">
                      <td colSpan={3} className="px-6 py-4 text-[10px] uppercase tracking-widest text-gray-400">Visible Totals</td>
                      <td className="px-6 py-4 text-right text-sm">€{listTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">€{listTotals.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-sm text-amber-600">
                        {listTotals.remaining > 0 ? `€${listTotals.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
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
