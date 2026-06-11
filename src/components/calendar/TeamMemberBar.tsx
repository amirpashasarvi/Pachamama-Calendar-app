import React from 'react';
import { differenceInDays, isAfter, isBefore, parseISO, startOfDay, endOfWeek, eachWeekOfInterval, max, min } from 'date-fns';
import { TeamAssignment, TeamPosition } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useBooking } from '@/hooks/useBooking';

interface TeamMemberBarProps {
  key?: React.Key;
  assignment: TeamAssignment;
  days: Date[];
  color: string;
  isOverlapping: boolean;
  onEdit: () => void;
}

export default function TeamMemberBar({ assignment, days, color, isOverlapping, onEdit }: TeamMemberBarProps) {
  const { calendarDisplaySettings } = useBooking();
  const dayWidth = 56;
  const halfDay = dayWidth / 2;
  
  const start = startOfDay(parseISO(assignment.startDate));
  const end = startOfDay(parseISO(assignment.endDate));
  const calendarStart = startOfDay(days[0]);
  const calendarEnd = startOfDay(days[days.length - 1]);

  if (isAfter(start, calendarEnd) || isBefore(end, calendarStart)) {
    return null;
  }

  const nights = differenceInDays(end, start);
  const startOffsetDays = differenceInDays(start, calendarStart);
  
  const left = (startOffsetDays) * dayWidth;
  const totalWidth = (nights + 1) * dayWidth;

  // Overlap warning color is no longer needed on the bar itself as grid cells handle it
  const finalColor = color;

  // Polygon points for clinical look
  const slope = 8; 
  const gap = -2; // Negative gap to ensure overlap and cover borders
  
  // Account for the extra bleed in coordinates relative to (left - 1)
  const relCheckInCenter = halfDay + 1;
  const relCheckOutMid = totalWidth - halfDay + 1;

  const p1 = `${relCheckInCenter + slope + gap}px 0%`; 
  const p4 = `${relCheckInCenter - slope + gap}px 100%`;
  const p2 = `${relCheckOutMid + slope - gap}px 0%`;
  const p3 = `${relCheckOutMid - slope - gap}px 100%`;

  const renderField = (fieldId: string) => {
    switch (fieldId) {
      case 'name':
        return assignment.name;
      case 'accommodation':
      case 'accommodationNotes': {
        const text = assignment.accommodation || assignment.roomNotes;
        if (!text) return null;
        return text.length > 20 ? text.substring(0, 20) + '...' : text;
      }
      case 'notes':
        if (!assignment.notes) return null;
        return assignment.notes.length > 20 ? assignment.notes.substring(0, 20) + '...' : assignment.notes;
      default:
        return null;
    }
  };

  const enabledFields = calendarDisplaySettings?.teamRosterBarFields?.filter(f => f.enabled) || [{ id: 'name', enabled: true }];
  
  const content = enabledFields.map(field => {
    const value = renderField(field.id);
    if (!value) return null;
    return value;
  }).filter(Boolean);

  const displayText = content.join(' · ');

  // One label per calendar week (Sun–Sat), centered in that week's portion of the bar
  const weekSegments = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 })
    .map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      const overlapStart = max([start, weekStart]);
      const overlapEnd = min([end, weekEnd]);
      if (overlapStart > overlapEnd) return null;

      const segLeft = differenceInDays(overlapStart, start) * dayWidth;
      const segDays = differenceInDays(overlapEnd, overlapStart) + 1;
      const segWidth = segDays * dayWidth;

      return { left: segLeft, width: segWidth };
    })
    .filter((s): s is { left: number; width: number } => s !== null);

  const polygonPath = `polygon(${p1}, ${p2}, ${p3}, ${p4})`;

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0.8 }}
      animate={{ opacity: 1, scaleY: 1 }}
      className={cn(
        "absolute h-9 top-2.5 z-20 cursor-pointer pointer-events-auto shadow-sm transition-transform hover:scale-[1.01] active:brightness-95 overflow-hidden flex items-center justify-center text-black"
      )}
      style={{
        left: `${left - 1}px`, // Slight bleed to cover border
        width: `${totalWidth + 2}px`, // Slight bleed to cover border
        clipPath: polygonPath,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      {/* 1. Base white layer to mask grid lines */}
      <div className="absolute inset-0 bg-white" />
      
      {/* 2. Color layer (transparent) */}
      <div 
        className="absolute inset-0" 
        style={{ 
          backgroundColor: `${finalColor}33`,
          borderBottom: `3px solid ${finalColor}` 
        }} 
      />

      {/* 3. Content layer — repeated once per calendar week */}
      {displayText && (
        <div className="relative z-10 h-full w-full pointer-events-none">
          {weekSegments.map((seg, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 flex items-center justify-center"
              style={{ left: seg.left, width: seg.width }}
            >
              <span
                className="text-[10px] font-bold italic truncate px-1"
                style={{ maxWidth: Math.max(0, seg.width - 8) }}
              >
                {displayText}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
