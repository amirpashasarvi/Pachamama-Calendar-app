import { isWeekend, startOfDay, format } from 'date-fns';
import { Booking, Room } from '@/types';
import { User, LogIn, LogOut, Baby } from 'lucide-react';

interface SummaryRowProps {
  days: Date[];
  bookings: Booking[];
  rooms: Room[];
}

export default function SummaryRow({ days, bookings, rooms }: SummaryRowProps) {
  const roomIds = new Set(rooms.map(r => r.id));

  // Only count bookings for rooms that actually exist
  const activeBookings = bookings.filter(b => roomIds.has(b.roomId));

  const stats = days.map(day => {
    const dStr = format(day, 'yyyy-MM-dd');
    const d = startOfDay(day);
    
    const checkIns = activeBookings.filter(b => b.checkIn === dStr);
    const checkOuts = activeBookings.filter(b => b.checkOut === dStr);
    
    // Calculate guests staying tonight (including those checking in today, excluding those checking out today)
    const stayingStayers = activeBookings.filter(b => {
      const start = b.checkIn;
      const end = b.checkOut;
      // Staying if day is between check-in (inclusive) and check-out (exclusive)
      return (dStr === start || dStr > start) && dStr < end;
    });

    return {
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
      adults: stayingStayers.reduce((acc, b) => acc + (b.adults || 0), 0),
      kids: stayingStayers.reduce((acc, b) => acc + (b.kids || 0), 0)
    };
  });

  return (
    <div className="flex bg-gray-100 border-t border-gray-400 sticky bottom-0 z-[90] border-l border-gray-400">
      <div className="w-48 sticky left-0 z-[100] bg-gray-100 border-r border-gray-400 p-2 flex flex-col justify-center text-[11px] font-bold text-gray-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] flex-shrink-0">
        Summary
      </div>
      
      {stats.map((stat, i) => (
        <div 
          key={`summary-${days[i].getTime()}`} 
          className={`w-14 flex-shrink-0 border-r border-gray-400 py-1 flex flex-col items-center justify-between h-20 text-[10px] ${isWeekend(days[i]) ? 'bg-gray-300' : ''}`}
        >
          <div className="flex flex-col gap-0.5 w-full items-center">
            <div className="flex items-center gap-1 text-blue-700 font-bold" title="Adults">
               <User size={10} /> {stat.adults}
            </div>
            <div className="flex items-center gap-1 text-purple-600 font-bold" title="Kids">
               <Baby size={10} /> {stat.kids}
            </div>
          </div>
          <div className="flex flex-col gap-0.5 w-full items-center">
            <div className="flex items-center gap-1 text-green-600 font-bold" title="Check-ins">
               <LogIn size={10} /> {stat.checkIns}
            </div>
            <div className="flex items-center gap-1 text-orange-600 font-bold" title="Check-outs">
               <LogOut size={10} /> {stat.checkOuts}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
