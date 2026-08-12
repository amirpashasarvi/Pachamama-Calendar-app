import { memo } from 'react';
import { isAfter, isBefore, differenceInDays, isWeekend, parseISO, isValid } from 'date-fns';
import { Retreat, VenueHire, Booking, Room } from '@/types';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';
import GuestSearch from './GuestSearch';

interface RetreatBarProps {
  days: Date[];
  retreats: Retreat[];
  venueHires: VenueHire[];
  onEdit: (retreat: Retreat) => void;
  onEditVenue: (venueHire: VenueHire) => void;
  compact?: boolean;
  bookings?: Booking[];
  rooms?: Room[];
  onSelectGuestBooking?: (booking: Booking) => void;
}

function diagonalClip(width: number, slope = 6): string {
  const halfDay = 28;
  const p1 = `${halfDay + slope + 1}px 0%`;
  const p4 = `${halfDay - slope + 1}px 100%`;
  const p2 = `${width - halfDay + slope + 1}px 0%`;
  const p3 = `${width - halfDay - slope + 1}px 100%`;
  return `polygon(${p1}, ${p2}, ${p3}, ${p4})`;
}

function RetreatBar({
  days,
  retreats,
  venueHires,
  onEdit,
  onEditVenue,
  compact = false,
  bookings = [],
  rooms = [],
  onSelectGuestBooking,
}: RetreatBarProps) {
  const dayWidth = 56;
  const calendarStart = days[0];
  const calendarEnd = days[days.length - 1];
  const layout = calendarLayoutClasses(compact);

  const barClass = cn(
    'absolute shadow-sm overflow-hidden whitespace-nowrap flex items-center justify-center px-2 cursor-pointer hover:brightness-95 transition-all z-20 pointer-events-auto',
    layout.bookingBar,
  );

  return (
    <div className={cn('flex -mt-px border-b border-gray-400 sticky z-[85] bg-gray-200 group border-l border-gray-400 border-t-0', layout.roomRow, layout.retreatStickyTop)}>
      <div
        className={cn(
          'sticky left-0 z-[80] bg-white border-r border-gray-400 border-t-0 border-b-0 flex items-center justify-center flex-shrink-0 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] overflow-visible',
          layout.roomLabelCol,
          layout.roomLabelPad,
        )}
      >
        {onSelectGuestBooking ? (
          <GuestSearch
            bookings={bookings}
            rooms={rooms}
            compact={compact}
            onSelectBooking={onSelectGuestBooking}
          />
        ) : null}
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
            const start = parseISO(retreat.startDate);
            const end = parseISO(retreat.endDate);
            if (!isValid(start) || !isValid(end)) return null;

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
            const start = parseISO(vh.startDate);
            const end = parseISO(vh.endDate);
            if (!isValid(start) || !isValid(end)) return null;

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
