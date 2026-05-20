import React from 'react';
import { format, isWeekend, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { TeamAssignment, TeamPosition } from '@/types';
import TeamMemberBar from './TeamMemberBar';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamRosterSectionProps {
  days: Date[];
  positions: TeamPosition[];
  assignments: TeamAssignment[];
  onAddAssignment: (positionId: string, date: Date) => void;
  onEditAssignment: (assignment: TeamAssignment) => void;
  isAdmin: boolean;
}

export default function TeamRosterSection({ 
  days, 
  positions, 
  assignments, 
  onAddAssignment, 
  onEditAssignment,
  isAdmin
}: TeamRosterSectionProps) {
  
  const getDayCoverage = (assignment: TeamAssignment, day: Date) => {
    const start = startOfDay(parseISO(assignment.startDate)).getTime();
    const end = startOfDay(parseISO(assignment.endDate)).getTime();
    const current = startOfDay(day).getTime();

    if (current < start || current > end) return null;
    
    const isStart = current === start;
    const isEnd = current === end;
    
    if (isStart && isEnd) return 'full';
    if (isStart) return 'right';
    if (isEnd) return 'left';
    return 'full';
  };

  const isCellOverlapping = (day: Date, posAssignments: TeamAssignment[]) => {
    const coverages = posAssignments.map(a => getDayCoverage(a, day)).filter(Boolean);
    
    let leftCount = 0;
    let rightCount = 0;
    
    for (const c of coverages) {
      if (c === 'full') {
        leftCount++;
        rightCount++;
      } else if (c === 'left') {
        leftCount++;
      } else if (c === 'right') {
        rightCount++;
      }
    }
    
    return leftCount > 1 || rightCount > 1;
  };

  const checkOverlap = (a1: TeamAssignment, others: TeamAssignment[]) => {
    const start1 = startOfDay(parseISO(a1.startDate));
    const end1 = startOfDay(parseISO(a1.endDate));
    
    // An assignment overlaps if any of its days is an overlap cell
    let current = start1;
    while (current <= end1) {
      if (isCellOverlapping(current, others)) return true;
      current = new Date(current.getTime() + 86400000);
    }
    return false;
  };

  return (
    <div className="flex flex-col">
      {/* Label Row */}
      <div className="flex bg-gray-50 border-b border-gray-400 h-8 items-center">
        <div className="w-48 sticky left-0 z-[85] bg-gray-100 border-r border-gray-400 h-full flex items-center px-4 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Team Roster</span>
        </div>
        <div className="flex-1 h-full bg-gray-50/50" />
      </div>

      {positions.map(pos => {
        const posAssignments = assignments.filter(a => a.positionId === pos.id);
        
        return (
          <div key={pos.id} className="flex relative border-b border-gray-300 h-14 bg-white group">
            {/* Position Label */}
            <div className="w-48 sticky left-0 z-[80] bg-white border-r border-gray-400 p-2 flex items-center gap-2 flex-shrink-0 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pos.color }} />
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tight truncate">{pos.name}</span>
            </div>

            {/* Grid */}
            <div className="flex-1 relative flex">
              {days.map((day, idx) => {
                const dayAssignments = posAssignments.filter(a => {
                  const start = startOfDay(parseISO(a.startDate));
                  const end = startOfDay(parseISO(a.endDate));
                  const current = startOfDay(day);
                  return current >= start && current <= end;
                });
                const isOccupied = dayAssignments.length > 0;
                const isOverlapping = isCellOverlapping(day, posAssignments);

                // Calculate clip-path for overlapping area to align with bar slopes
                let clipPath = 'none';
                if (isOverlapping) {
                  const slope = 8;
                  const gap = 1;
                  const halfDay = 28;
                  
                  // Check if any bar in this cell is a start or end day
                  const hasStart = dayAssignments.some(a => startOfDay(parseISO(a.startDate)).getTime() === startOfDay(day).getTime());
                  const hasEnd = dayAssignments.some(a => startOfDay(parseISO(a.endDate)).getTime() === startOfDay(day).getTime());

                  const xStartTop = hasStart ? halfDay + slope + gap : 0;
                  const xStartBottom = hasStart ? halfDay - slope + gap : 0;
                  const xEndTop = hasEnd ? halfDay + slope - gap : 56;
                  const xEndBottom = hasEnd ? halfDay - slope - gap : 56;

                  clipPath = `polygon(${xStartTop}px 0%, ${xEndTop}px 0%, ${xEndBottom}px 100%, ${xStartBottom}px 100%)`;
                }

                return (
                  <div 
                    key={`${pos.id}-${idx}`}
                    className={cn(
                      "w-14 flex-shrink-0 border-r border-gray-300 h-full transition-colors flex items-center justify-center text-blue-400 relative",
                      isWeekend(day) ? 'bg-gray-100' : '',
                      isAdmin && !isOccupied ? 'cursor-plus hover:bg-blue-50/20' : ''
                    )}
                    onClick={() => isAdmin && !isOccupied && onAddAssignment(pos.id, day)}
                  >
                    {isOverlapping && (
                      <div 
                        className="absolute h-9 top-2.5 left-0 right-0 z-10 pointer-events-none"
                        style={{ 
                          backgroundColor: pos.color,
                          clipPath
                        }}
                      />
                    )}
                    {isAdmin && !isOccupied && (
                      <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                );
              })}

              {/* Bars */}
              <div className="absolute inset-0 pointer-events-none">
                {posAssignments.map(a => (
                  <TeamMemberBar 
                    key={a.id}
                    assignment={a}
                    days={days}
                    color={pos.color}
                    isOverlapping={checkOverlap(a, posAssignments)}
                    onEdit={() => onEditAssignment(a)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
