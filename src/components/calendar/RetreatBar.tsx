import { isSameDay, isAfter, isBefore, differenceInDays, isWeekend } from 'date-fns';
import { Retreat, VenueHire } from '@/types';
import { Plus } from 'lucide-react';

interface RetreatBarProps {
  days: Date[];
  retreats: Retreat[];
  venueHires: VenueHire[];
  onAdd: () => void;
  onEdit: (retreat: Retreat) => void;
  onAddVenue: () => void;
  onEditVenue: (venueHire: VenueHire) => void;
}

function diagonalClip(width: number, slope = 6): string {
  const halfDay = 28;
  const p1 = `${halfDay + slope + 1}px 0%`;
  const p4 = `${halfDay - slope + 1}px 100%`;
  const p2 = `${width - halfDay + slope + 1}px 0%`;
  const p3 = `${width - halfDay - slope + 1}px 100%`;
  return `polygon(${p1}, ${p2}, ${p3}, ${p4})`;
}

export default function RetreatBar({ days, retreats, venueHires, onAdd, onEdit, onAddVenue, onEditVenue }: RetreatBarProps) {
  const dayWidth = 56;
  const calendarStart = days[0];
  const calendarEnd = days[days.length - 1];

  return (
    <div className="flex h-12 border-b border-gray-400 sticky top-12 z-[85] bg-gray-200 group border-l border-gray-400">
      <div 
        className="w-28 sm:w-48 sticky left-0 z-[80] bg-gray-200 border-r border-gray-400 p-2 flex flex-col justify-center gap-1 flex-shrink-0 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
      >
        <button 
          onClick={onAdd}
          className="w-full h-4 flex items-center justify-between px-2 bg-blue-100 hover:bg-blue-200 transition-colors rounded text-[9px] font-black uppercase tracking-tighter text-blue-700 border border-blue-200"
        >
          <span>Retreats</span>
          <Plus size={10} />
        </button>
        <button 
          onClick={onAddVenue}
          className="w-full h-4 flex items-center justify-between px-2 bg-orange-100 hover:bg-orange-200 transition-colors rounded text-[9px] font-black uppercase tracking-tighter text-orange-700 border border-orange-200"
        >
          <span>Venue Hire</span>
          <Plus size={10} />
        </button>
      </div>
      
      <div className="flex-1 relative flex">
        {days.map((day, idx) => (
          <div 
            key={`retreat-grid-${day.toISOString()}-${idx}`} 
            className={`w-14 flex-shrink-0 border-r border-gray-400 h-full ${isWeekend(day) ? 'bg-gray-300' : ''}`}
          />
        ))}

        <div className="absolute inset-0 pointer-events-none">
          {retreats.map(retreat => {
            const start = new Date(retreat.startDate);
            const end = new Date(retreat.endDate);
            
            if (isAfter(start, calendarEnd) || isBefore(end, calendarStart)) return null;

            const startOffset = Math.max(0, differenceInDays(start, calendarStart));
            const duration = differenceInDays(end, start) + 1;
            
            const left = startOffset * dayWidth;
            const width = duration * dayWidth;

            return (
              <div 
                key={`retreat-${retreat.id}`}
                className="absolute top-0.5 h-5 bg-blue-200 border border-blue-400 shadow-sm overflow-hidden whitespace-nowrap flex items-center justify-center px-2 cursor-pointer hover:brightness-95 transition-all z-20 pointer-events-auto"
                style={{ left: left - 1, width: width + 2, clipPath: diagonalClip(width + 2) }}
                onClick={() => onEdit(retreat)}
              >
                <span className="text-[9px] font-bold text-blue-950 uppercase tracking-tight truncate w-full text-center">
                  {retreat.name} · <span className="opacity-60 font-normal lowercase italic">by {retreat.facilitator}</span>
                </span>
              </div>
            );
          })}

          {venueHires.map(vh => {
            const start = new Date(vh.startDate);
            const end = new Date(vh.endDate);
            
            if (isAfter(start, calendarEnd) || isBefore(end, calendarStart)) return null;

            const startOffset = Math.max(0, differenceInDays(start, calendarStart));
            const duration = differenceInDays(end, start) + 1;
            
            const left = startOffset * dayWidth;
            const width = duration * dayWidth;

            return (
              <div 
                key={`venue-hire-${vh.id}`}
                className="absolute bottom-0.5 h-5 bg-orange-200 border border-orange-400 shadow-sm overflow-hidden whitespace-nowrap flex items-center justify-center px-2 cursor-pointer hover:brightness-95 transition-all z-20 pointer-events-auto"
                style={{ left: left - 1, width: width + 2, clipPath: diagonalClip(width + 2) }}
                onClick={() => onEditVenue(vh)}
              >
                <span className="text-[9px] font-bold text-orange-850 uppercase tracking-tight truncate w-full text-center">
                  Venue Hire · {String(vh.name)} <span className="opacity-60 font-normal ml-1 lowercase italic">by {String(vh.organizer)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

