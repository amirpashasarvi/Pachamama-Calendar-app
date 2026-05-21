import React, { useState, useMemo } from 'react';
import { X, Calendar as CalendarIcon, TrendingUp, Wallet, Clock, Percent, Download, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from '@/components/ui/DatePicker';
import { Booking, Room, ConfigOption, VenueHire } from '@/types';
import { cn } from '@/lib/utils';
import { 
  format, 
  subMonths, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  parseISO, 
  eachDayOfInterval, 
  eachMonthOfInterval,
  eachWeekOfInterval,
  isSameDay,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameWeek
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  venueHires?: VenueHire[];
  rooms: Room[];
  bookingChannels: ConfigOption[];
}

type Period = 'All' | '1M' | '3M' | '6M' | '12M' | 'Custom';

export default function StatisticsModal({ isOpen, onClose, bookings, venueHires = [], rooms, bookingChannels }: StatisticsModalProps) {
  const [period, setPeriod] = useState<Period>('1M');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'checkIn' | 'createdAt'>('checkIn');
  const [searchQuery, setSearchQuery] = useState('');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({
    from: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const combinedItems = useMemo(() => {
    const mappedBookings = bookings.map(b => ({
      ...b,
      isVenueHire: false,
      type: b.type || 'Other',
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
      channelPaymentBasis: vh.channelPaymentBasis,
      createdAt: vh.createdAt,
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
      if (period === 'All') return matchesRoom;
      
      const checkInDate = parseISO(b.checkIn);
      const isWithinDate = isWithinInterval(checkInDate, { start, end });
      return isWithinDate && matchesRoom;
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
  }, [period, roomFilter, sortBy, customRange, combinedItems]);

  const searchedItems = useMemo(() => {
    let result = filteredItems;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(b => b.guestName.toLowerCase().includes(query));
    }

    if (statusFilter !== 'all') {
      result = result.filter(b => {
        const total = b.financials.price + (b.financials.extras || []).reduce((s, e) => s + (e.amount || 0), 0);
        const collected = b.financials.deposit + b.financials.paidLater1 + b.financials.paidLater2;
        const remaining = total - collected;
        if (statusFilter === 'paid') return remaining === 0;
        if (statusFilter === 'partial') return remaining > 0 && collected > 0;
        if (statusFilter === 'unpaid') return collected === 0 && total > 0;
        return true;
      });
    }

    return result;
  }, [filteredItems, searchQuery, statusFilter]);

  const tableTotals = useMemo(() => {
    let revenue = 0;
    let collected = 0;
    let commissions = 0;

    searchedItems.forEach(b => {
      const extrasAmount = (b.financials.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      revenue += b.financials.price + extrasAmount;
      collected += b.financials.deposit + b.financials.paidLater1 + b.financials.paidLater2;

      const channel = bookingChannels.find(c => c.name === b.bookingChannel);
      if (channel && channel.commission) {
        const basisAmount = b.channelPaymentBasis === 'bookingPrice' ? b.financials.price : b.financials.deposit;
        commissions += (basisAmount * channel.commission) / 100;
      }
    });

    return { revenue, collected, remaining: revenue - collected, commissions };
  }, [searchedItems, bookingChannels]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalCommissions = 0;
    let overdue = 0;
    let expected = 0;
    const today = startOfDay(new Date());

    filteredItems.forEach(b => {
      const extrasAmount = (b.financials.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const bookingTotal = b.financials.price + extrasAmount;
      const collected = b.financials.deposit + b.financials.paidLater1 + b.financials.paidLater2;
      const remaining = bookingTotal - collected;

      totalRevenue += bookingTotal;
      totalCollected += collected;

      if (remaining > 0) {
        if (parseISO(b.checkOut) < today) {
          overdue += remaining;
        } else {
          expected += remaining;
        }
      }

      const channel = bookingChannels.find(c => c.name === b.bookingChannel);
      if (channel && channel.commission) {
        const basisAmount = b.channelPaymentBasis === 'bookingPrice' ? b.financials.price : b.financials.deposit;
        totalCommissions += (basisAmount * channel.commission) / 100;
      }
    });

    return {
      revenue: totalRevenue,
      collected: totalCollected,
      overdue,
      expected,
      commissions: totalCommissions,
      count: filteredItems.length
    };
  }, [filteredItems, bookingChannels]);

  const occupancyData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const isShortPeriod = differenceInDays(endDate, startDate) < 62;
    
    const intervals = isShortPeriod 
      ? eachWeekOfInterval({ start: startDate, end: endDate })
      : eachMonthOfInterval({ start: startDate, end: endDate });

    const data = intervals.map(intervalStart => {
      const intervalEnd = isShortPeriod ? endOfWeek(intervalStart) : endOfMonth(intervalStart);
      const intervalDays = eachDayOfInterval({ 
        start: intervalStart < startDate ? startDate : intervalStart, 
        end: intervalEnd > endDate ? endDate : intervalEnd 
      });

      let occupiedNights = 0;
      const roomsToConsider = roomFilter === 'all' ? rooms : rooms.filter(r => r.id === roomFilter);
      const totalPossibleNights = intervalDays.length * roomsToConsider.length;

      intervalDays.forEach(day => {
        // A night is occupied if any booking covers that date for the selected room(s)
        // Check-out date is not counted as occupied for that night
        roomsToConsider.forEach(room => {
          const isOccupied = bookings.some(b => {
            if (b.roomId !== room.id) return false;
            const bIn = parseISO(b.checkIn);
            const bOut = parseISO(b.checkOut);
            // Check if 'day' is between bIn and bOut (exclusive of bOut)
            return day >= bIn && day < bOut;
          });
          if (isOccupied) occupiedNights++;
        });
      });

      const percentage = totalPossibleNights > 0 ? (occupiedNights / totalPossibleNights) * 100 : 0;

      return {
        name: isShortPeriod ? `W${format(intervalStart, 'w')}` : format(intervalStart, 'MMM'),
        fullName: isShortPeriod ? `Week of ${format(intervalStart, 'dd MMM')}` : format(intervalStart, 'MMMM yyyy'),
        occupancy: Math.round(percentage)
      };
    });

    return data;
  }, [startDate, endDate, bookings, rooms, roomFilter]);

  const exportToCSV = () => {
    const headers = ['Guest Name', 'Room', 'Check-in', 'Check-out', 'Channel', 'Total (€)', 'Collected (€)', 'Remaining (€)', 'Commission (€)', 'Status'];
    const rows = filteredItems.map(b => {
      const extrasAmount = (b.financials.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const total = b.financials.price + extrasAmount;
      const collected = b.financials.deposit + b.financials.paidLater1 + b.financials.paidLater2;
      const remaining = total - collected;
      const channel = bookingChannels.find(c => c.name === b.bookingChannel);
      const commission = channel && channel.commission 
        ? (b.channelPaymentBasis === 'bookingPrice' ? b.financials.price : b.financials.deposit) * channel.commission / 100
        : 0;
      
      let status = 'Unpaid';
      if (remaining === 0) status = 'Paid';
      else if (collected > 0) status = 'Partial';

      const room = b.isVenueHire ? 'Venue Hire' : (rooms.find(r => r.id === b.roomId)?.name || 'Unknown');

      return [
        b.guestName,
        room,
        b.checkIn,
        b.checkOut,
        b.bookingChannel,
        total.toFixed(2),
        collected.toFixed(2),
        remaining.toFixed(2),
        commission.toFixed(2),
        status
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_stats_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SummaryCard = ({ title, value, icon: Icon, colorClass }: { title: string, value: string, icon: any, colorClass: string }) => (
    <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</span>
        <div className={cn("p-2 rounded-xl", colorClass)}>
          <Icon size={18} />
        </div>
      </div>
      <div>
        <h4 className="text-2xl font-black tracking-tight">{value}</h4>
      </div>
    </div>
  );

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
          <header className="h-16 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <h2 className="text-xl font-black tracking-tight">Business Statistics</h2>
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
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Period</span>
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Custom Dates</span>
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
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Room Filter</span>
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
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <SummaryCard 
                title="Total Revenue" 
                value={`€${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={TrendingUp}
                colorClass="bg-blue-50 text-blue-600"
              />
              <SummaryCard 
                title="Collected" 
                value={`€${stats.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={Wallet}
                colorClass="bg-green-50 text-green-600"
              />
              <SummaryCard 
                title="Overdue (past)" 
                value={`€${stats.overdue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={Clock}
                colorClass="bg-rose-50 text-rose-600"
              />
              <SummaryCard 
                title="Expected (future)" 
                value={`€${stats.expected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={CalendarIcon}
                colorClass="bg-amber-50 text-amber-600"
              />
              <div className="col-span-2 sm:col-span-1">
                <SummaryCard 
                  title="Channel Commissions" 
                  value={`€${stats.commissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={Percent}
                  colorClass="bg-purple-50 text-purple-600"
                />
              </div>
            </div>

            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">
              Based on {stats.count} records with check-in in this period
            </div>

            {/* Occupancy Chart */}
            <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Occupancy</h3>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                  <span>Occupied %</span>
                </div>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancyData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-black text-white p-3 rounded-xl shadow-xl border-none">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                {payload[0].payload.fullName}
                              </p>
                              <p className="text-sm font-black">{payload[0].value}% Occupancy</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="occupancy" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40}
                    >
                      {occupancyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#3b82f6" />
                      ))}
                      <LabelList 
                        dataKey="occupancy" 
                        position="top" 
                        formatter={(v: number) => `${v}%`}
                        style={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Guest</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Room</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Dates</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Channel</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Collected</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Remaining</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Comm.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {searchedItems.map(b => {
                      const extrasAmount = (b.financials.extras || []).reduce((sum, e) => sum + (e.amount || 0), 0);
                      const total = b.financials.price + extrasAmount;
                      const collected = b.financials.deposit + b.financials.paidLater1 + b.financials.paidLater2;
                      const remaining = total - collected;
                      
                      const channel = bookingChannels.find(c => c.name === b.bookingChannel);
                      const commission = channel && channel.commission 
                        ? (b.channelPaymentBasis === 'bookingPrice' ? b.financials.price : b.financials.deposit) * channel.commission / 100
                        : 0;

                      const isExpanded = expandedBookingId === b.id;
                      const roomName = b.isVenueHire 
                        ? <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-black uppercase whitespace-nowrap">Venue Hire</span>
                        : rooms.find(r => r.id === b.roomId)?.name || 'Unknown';

                      return (
                        <React.Fragment key={b.id}>
                          <tr 
                            onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                            className={cn(
                              "group cursor-pointer transition-colors",
                              isExpanded ? "bg-blue-50/30" : "hover:bg-gray-50/80"
                            )}
                          >
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
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: channel?.color || '#cbd5e1' }}
                                />
                                <span className="text-xs font-bold text-gray-600">{b.bookingChannel}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-xs font-black">€{total.toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-xs font-bold text-gray-600">€{collected.toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {remaining > 0 ? (
                                <span className="text-xs font-black text-amber-600">€{remaining.toLocaleString()}</span>
                              ) : (
                                <span className="text-xs font-bold text-green-600">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-xs font-bold text-gray-500">€{commission.toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {remaining === 0 ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-[10px] font-black uppercase">Paid</span>
                              ) : collected > 0 ? (
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-black uppercase">Partial</span>
                              ) : (
                                <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md text-[10px] font-black uppercase">Unpaid</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-300 group-hover:text-gray-600">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </td>
                          </tr>
                          
                          {isExpanded && (
                            <tr className="bg-blue-50/20">
                              <td colSpan={10} className="px-8 py-4 border-t border-blue-50">
                                <div className="grid grid-cols-2 gap-8 max-w-2xl">
                                  <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Financial Breakdown</h4>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">{b.isVenueHire ? 'Venue Price:' : 'Base Price:'}</span>
                                        <span className="font-bold">€{b.financials.price.toLocaleString()}</span>
                                      </div>
                                      {(b.financials.extras || []).map((e, i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                          <span className="text-gray-500">{e.label || 'Extra'}:</span>
                                          <span className="font-bold text-blue-600">+ €{(e.amount || 0).toLocaleString()}</span>
                                        </div>
                                      ))}
                                      <div className="pt-1 border-t flex justify-between text-xs font-black">
                                        <span>Total:</span>
                                        <span>€{total.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payments</h4>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Deposit:</span>
                                        <span className="font-bold">€{b.financials.deposit.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Paid Later 1:</span>
                                        <span className="font-bold">€{b.financials.paidLater1.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Paid Later 2:</span>
                                        <span className="font-bold">€{b.financials.paidLater2.toLocaleString()}</span>
                                      </div>
                                      <div className="pt-1 border-t flex justify-between text-xs font-black text-amber-600">
                                        <span>Remaining:</span>
                                        <span>€{remaining.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/80 font-black">
                      <td colSpan={4} className="px-6 py-4 text-[10px] uppercase tracking-widest text-gray-400">Visible Totals</td>
                      <td className="px-6 py-4 text-right text-sm">€{tableTotals.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">€{tableTotals.collected.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm text-amber-600">
                        {tableTotals.remaining > 0 ? `€${tableTotals.remaining.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-400">€{tableTotals.commissions.toLocaleString()}</td>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
