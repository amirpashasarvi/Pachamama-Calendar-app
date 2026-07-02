import { memo, useState, useRef, useEffect } from 'react';
import { isAfter, isBefore, differenceInDays, isWeekend } from 'date-fns';
import { Retreat, VenueHire } from '@/types';
import { Plus, ChevronDown, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';

interface RetreatBarProps {
  days: Date[];
  retreats: Retreat[];
  venueHires: VenueHire[];
  onAdd: () => void;
  onEdit: (retreat: Retreat) => void;
  onAddVenue: () => void;
  onEditVenue: (venueHire: VenueHire) => void;
  onBlockRooms?: () => void;
  compact?: boolean;
}

function diagonalClip(width: number, slope = 6): string {
  const halfDay = 28;
  const p1 = `${halfDay + slope + 1}px 0%`;
  const p4 = `${halfDay - slope + 1}px 100%`;
  const p2 = `${width - halfDay + slope + 1}px 0%`;
  const p3 = `${width - halfDay - slope + 1}px 100%`;
  return `polygon(${p1}, ${p2}, ${p3}, ${p4})`;
}

function RetreatBar({ days, retreats, venueHires, onAdd, onEdit, onAddVenue, onEditVenue, onBlockRooms, compact = false }: RetreatBarProps) {
  const dayWidth = 56;
  const calendarStart = days[0];
  const calendarEnd = days[days.length - 1];
  const layout = calendarLayoutClasses(compact);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const barClass = cn(
    'absolute shadow-sm overflow-hidden whitespace-nowrap flex items-center justify-center px-2 cursor-pointer hover:brightness-95 transition-all z-20 pointer-events-auto',
    layout.bookingBar,
  );

  return (
    <div className={cn('flex border-b border-gray-400 sticky z-[85] bg-gray-200 group border-l border-gray-400', layout.roomRow, layout.retreatStickyTop)}>
      <div
        className={cn(
          'sticky left-0 z-[80] bg-gray-200 border-r border-gray-400 flex items-center flex-shrink-0 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]',
          layout.roomLabelCol,
          layout.roomLabelPad,
        )}
      >
        <div className="relative w-full" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className={cn(
              'w-full flex items-center justify-center gap-1 bg-gray-800 text-white hover:bg-gray-700 transition-colors',
              layout.addBookingBtn,
            )}
          >
            <Plus size={layout.addBookingPlusSize} />
            <span className="truncate">Add Events</span>
            <ChevronDown size={layout.addBookingPlusSize} className={cn('shrink-0 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-full mt-1 w-full min-w-[9rem] bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onAdd(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <Plus size={10} className="shrink-0" />
                Retreats
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onAddVenue(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-orange-700 hover:bg-orange-50 transition-colors"
              >
                <Plus size={10} className="shrink-0" />
                Venue Hire
              </button>
              {onBlockRooms && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onBlockRooms(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Ban size={10} className="shrink-0" />
                  Block rooms
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative flex">
        {days.map((day, idx) => (
          <div
            key={`retreat-grid-${day.toISOString()}-${idx}`}
            className={cn('w-14 flex-shrink-0 border-r border-gray-400 h-full', isWeekend(day) && 'bg-gray-300')}
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
                className={cn(barClass, 'bg-blue-200 border border-blue-400')}
                style={{ left: left - 1, width: width + 2, clipPath: diagonalClip(width + 2) }}
                onClick={() => onEdit(retreat)}
              >
                <span className={cn('font-bold text-blue-950 uppercase tracking-tight truncate w-full text-center', layout.bookingBarText)}>
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
                className={cn(barClass, 'bg-orange-200 border border-orange-400')}
                style={{ left: left - 1, width: width + 2, clipPath: diagonalClip(width + 2) }}
                onClick={() => onEditVenue(vh)}
              >
                <span className={cn('font-bold text-orange-950 uppercase tracking-tight truncate w-full text-center', layout.bookingBarText)}>
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

export default memo(RetreatBar);
