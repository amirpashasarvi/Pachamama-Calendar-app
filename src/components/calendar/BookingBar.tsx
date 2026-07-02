import React, { memo } from 'react';
import { differenceInDays, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { Booking, CalendarDisplaySettings, ConfigOption } from '@/types';
import { cn } from '@/lib/utils';
import { calendarLayoutClasses } from '@/lib/calendarLayout';
import { Pin } from 'lucide-react';
import { blockedBarLabel, isBlockedBooking } from '@/lib/bookingBlock';

interface BookingBarProps {
  booking: Booking;
  days: Date[];
  roomColor: string;
  bookingTypes: ConfigOption[];
  calendarDisplaySettings: CalendarDisplaySettings | null;
  onEditBooking: (booking: Booking) => void;
  compact?: boolean;
}

function BookingBar({
  booking, days, bookingTypes, calendarDisplaySettings, onEditBooking, compact = false,
}: BookingBarProps) {
  const layout = calendarLayoutClasses(compact);
  const dayWidth = 56;
  const halfDay = dayWidth / 2;
  
  // Use startOfDay to normalize dates for comparison
  const checkIn = startOfDay(parseISO(booking.checkIn));
  const checkOut = startOfDay(parseISO(booking.checkOut));
  const calendarStart = startOfDay(days[0]);
  const calendarEnd = startOfDay(days[days.length - 1]);

  // If the booking is completely outside the visible range, skip
  if (isAfter(checkIn, calendarEnd) || isBefore(checkOut, calendarStart)) {
    return null;
  }

  const blocked = isBlockedBooking(booking);

  // Calculate position
  const nights = differenceInDays(checkOut, checkIn);
  const startOffsetDays = differenceInDays(checkIn, calendarStart);
  
  const left = (startOffsetDays) * dayWidth;
  const totalWidth = (nights + 1) * dayWidth;

  // Colors based on type
  const typeColors: Record<string, string> = {
    'Retreat': 'bg-emerald-100',
    'Coliving': 'bg-sky-100',
    'Festival': 'bg-amber-100',
    'Venue Hire': 'bg-rose-100',
    'Home Exchange': 'bg-purple-100',
    'Private': 'bg-indigo-100'
  };

  const matchedType = bookingTypes.find(t => t.name === booking.type);
  const customColor = matchedType?.color;
  const bgColor = customColor ? undefined : (typeColors[booking.type] || 'bg-gray-100');
  
  const statusLineColors: Record<string, string> = {
    'Paid': 'bg-green-500',
    'Partial': 'bg-yellow-400',
    'Unpaid': 'bg-red-600'
  };
  const statusLineColor = statusLineColors[booking.status] || 'bg-gray-400';

  // Polygon points for the diagonal split with gap, centered in the cells
  const slope = 12; 
  const gap = 3; // Small positive gap to create visible split between same-day checkout/checkin
  
  // Account for the extra bleed in coordinates relative to (left - 1)
  const relHalfDay = halfDay + 1;
  const relCheckOutMid = totalWidth - halfDay + 1;

  // Left edge (Check-in diagonal)
  const p1 = `${relHalfDay + slope + gap}px 0%`; 
  const p4 = `${relHalfDay - slope + gap}px 100%`;
  
  // Right edge (Check-out diagonal)
  const p2 = `${relCheckOutMid + slope - gap}px 0%`;
  const p3 = `${relCheckOutMid - slope - gap}px 100%`;

  // Dynamic field rendering based on settings
  const renderField = (fieldId: string) => {
    switch (fieldId) {
      case 'guestName':
        return booking.guestName;
      case 'adultsKids': {
        const parts = [];
        if (booking.adults > 0) parts.push(`${booking.adults}A`);
        if (booking.kids > 0) parts.push(`${booking.kids}K`);
        return parts.length > 0 ? parts.join(' ') : null;
      }
      case 'bookingType':
        return booking.type;
      case 'notes': {
        if (!booking.notes) return null;
        return booking.notes.length > 20 ? booking.notes.substring(0, 20) + '...' : booking.notes;
      }
      case 'bookingChannel':
        return booking.bookingChannel;
      case 'dietary':
        return booking.dietary || null;
      case 'paymentStatus': {
        const statusColors = {
          'Paid': 'bg-green-500 text-white',
          'Partial': 'bg-amber-500 text-white',
          'Unpaid': 'bg-rose-500 text-white'
        };
        const statusColor = statusColors[booking.status] || 'bg-gray-400';
        return (
          <span className={cn("px-1 rounded-[2px] text-[8px] font-black uppercase tracking-tighter inline-block align-middle mb-0.5", statusColor)}>
            {booking.status}
          </span>
        );
      }
      default:
        return null;
    }
  };

  const enabledFields = calendarDisplaySettings?.bookingBarFields?.filter(f => f.enabled) || [{ id: 'guestName', enabled: true }];
  
  const content = enabledFields.map(field => {
    const value = renderField(field.id);
    if (!value) return null;
    return <React.Fragment key={field.id}>{value}</React.Fragment>;
  }).filter(Boolean);

  // Manual join with bread dots to handle React elements (badges) correctly
  const joinedContent: React.ReactNode[] = [];
  content.forEach((node, idx) => {
    joinedContent.push(node);
    if (idx < content.length - 1) {
      joinedContent.push(<span key={`dot-${idx}`} className="mx-1 text-gray-400 font-normal">·</span>);
    }
  });

  const polygonPath = `polygon(${p1}, ${p2}, ${p3}, ${p4})`;

  if (blocked) {
    return (
      <div
        className={cn(
          'absolute z-20 cursor-pointer pointer-events-auto shadow-sm transition-transform hover:scale-[1.01] active:brightness-95 overflow-hidden',
          layout.bookingBar,
        )}
        style={{
          left: `${left - 1}px`,
          width: `${totalWidth + 2}px`,
          clipPath: polygonPath,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onEditBooking(booking);
        }}
      >
        <div className="absolute inset-0 bg-white" />
        <div className="absolute inset-0 bg-gray-300 border border-gray-400" />
        <div className={cn('relative z-10 flex items-center justify-center h-full w-full px-10 text-gray-800 font-bold leading-none not-italic', layout.bookingBarText, layout.bookingBarContentPad)}>
          <span className="truncate w-full text-center">{blockedBarLabel(booking.notes)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute z-20 cursor-pointer pointer-events-auto shadow-sm transition-transform hover:scale-[1.01] active:brightness-95 overflow-hidden',
        layout.bookingBar,
      )}
      style={{
        left: `${left - 1}px`,
        width: `${totalWidth + 2}px`,
        clipPath: polygonPath,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onEditBooking(booking);
      }}
    >
      {/* 1. Base white layer to mask grid lines */}
      <div className="absolute inset-0 bg-white" />
      
      {/* 2. Color layer (opaque for standard types, transparent for custom) */}
      <div 
        className={cn("absolute inset-0", bgColor)} 
        style={{ backgroundColor: customColor ? customColor : undefined }}
      />

      {/* 3. Content layer */}
      <div className={cn('relative z-10 flex flex-col items-center justify-center h-full w-full px-10 text-black font-bold leading-none', layout.bookingBarText, layout.bookingBarContentPad)}>
        <div className="truncate w-full text-center flex items-center justify-center gap-0.5 whitespace-nowrap overflow-hidden italic">
          {joinedContent}
        </div>
      </div>

      {booking.comments && typeof booking.comments === 'string' && booking.comments.trim() !== '' && (
        <div 
          className="absolute top-1/2 -translate-y-[calc(50%+2px)] z-30 pointer-events-none text-red-500"
          style={{ right: `${halfDay}px` }}
        >
          <Pin size={layout.bookingBarPinSize} fill="currentColor" />
        </div>
      )}
      
      {/* Thick status line at bottom */}
      <div className={cn('absolute bottom-0 left-0 right-0 z-20', layout.bookingBarStatusLine, statusLineColor)} />
    </div>
  );
}

export default memo(BookingBar);
