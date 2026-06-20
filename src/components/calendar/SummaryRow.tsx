import { useMemo } from 'react';
import { isWeekend, format } from 'date-fns';
import { Booking, Room } from '@/types';
import { User, LogIn, LogOut, Baby } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';

interface SummaryRowProps {
  days: Date[];
  bookings: Booking[];
  rooms: Room[];
  compact?: boolean;
}

export default function SummaryRow({ days, bookings, rooms, compact = true }: SummaryRowProps) {
  const layout = calendarLayoutClasses(compact);

  const stats = useMemo(() => {
    const roomIds = new Set(rooms.map(r => r.id));
    const activeBookings = bookings.filter(b => roomIds.has(b.roomId));

    return days.map(day => {
      const dStr = format(day, 'yyyy-MM-dd');

      const checkIns = activeBookings.filter(b => b.checkIn === dStr);
      const checkOuts = activeBookings.filter(b => b.checkOut === dStr);

      const stayingStayers = activeBookings.filter(b => {
        const start = b.checkIn;
        const end = b.checkOut;
        return (dStr === start || dStr > start) && dStr < end;
      });

      return {
        checkIns: checkIns.length,
        checkOuts: checkOuts.length,
        adults: stayingStayers.reduce((acc, b) => acc + (b.adults || 0), 0),
        kids: stayingStayers.reduce((acc, b) => acc + (b.kids || 0), 0),
      };
    });
  }, [days, bookings, rooms]);

  return (
    <div className="flex bg-gray-100 border-t border-gray-400 sticky bottom-0 z-[90] border-l border-gray-400">
      <div className={cn('sticky left-0 z-[100] bg-gray-100 border-r border-gray-400 flex flex-col justify-center font-bold text-gray-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] flex-shrink-0', layout.roomLabelCol, layout.roomLabelPad, compact ? 'text-[10px]' : 'text-[11px]')}>
        Summary
      </div>

      {stats.map((stat, i) => (
        <div
          key={`summary-${days[i].getTime()}`}
          className={cn(
            'w-14 flex-shrink-0 border-r border-gray-400 py-0.5 flex flex-col items-center justify-center gap-0.5',
            layout.summaryCell,
            layout.summaryText,
            isWeekend(days[i]) ? 'bg-gray-300' : ''
          )}
        >
          <div className="flex items-center justify-center gap-1.5 w-full">
            <div className="flex items-center gap-0.5 text-blue-700 font-bold" title="Adults">
              <User size={compact ? 8 : 10} /> {stat.adults}
            </div>
            <div className="flex items-center gap-0.5 text-purple-600 font-bold" title="Kids">
              <Baby size={compact ? 8 : 10} /> {stat.kids}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 w-full">
            <div className="flex items-center gap-0.5 text-green-600 font-bold" title="Check-ins">
              <LogIn size={compact ? 8 : 10} /> {stat.checkIns}
            </div>
            <div className="flex items-center gap-0.5 text-orange-600 font-bold" title="Check-outs">
              <LogOut size={compact ? 8 : 10} /> {stat.checkOuts}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
