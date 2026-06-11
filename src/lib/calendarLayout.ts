export const COMPACT_CALENDAR_STORAGE_KEY = 'pachamama-calendar-compact';

export function loadCompactCalendarPreference(): boolean {
  try {
    const stored = localStorage.getItem(COMPACT_CALENDAR_STORAGE_KEY);
    if (stored === null) return true;
    return stored === 'true';
  } catch {
    return true;
  }
}

export function saveCompactCalendarPreference(compact: boolean): void {
  try {
    localStorage.setItem(COMPACT_CALENDAR_STORAGE_KEY, String(compact));
  } catch {
    // ignore storage errors
  }
}

export function housekeepingStatusLabel(status: string): string {
  if (status === 'dirty') return 'Dirty';
  if (status === 'cleaned') return 'Cleaned';
  if (status === 'inspected') return 'Inspected';
  return 'Clean';
}

export function calendarLayoutClasses(compact: boolean) {
  return {
    appHeader: compact ? 'h-11' : 'h-14',
    appHeaderPx: compact ? 'px-4' : 'px-6',
    appTitle: compact ? 'text-lg' : 'text-xl',
    appIconBtn: compact ? 'p-1.5' : 'p-2',
    appIconSize: compact ? 16 : 18,
    calHeaderRow: compact ? 'h-10' : 'h-14',
    monthBtn: compact
      ? 'px-2 py-0.5 rounded text-xs font-bold transition-all'
      : 'px-3 py-1.5 rounded-md text-sm font-bold transition-all',
    todayBtn: compact ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-2 sm:py-1',
    dateHeaderRow: compact ? 'h-9' : 'h-12',
    dateHeaderWeekday: compact ? 'text-[8px]' : 'text-[10px]',
    dateHeaderDayNum: compact ? 'text-xs' : 'text-sm',
    roomLabelCol: compact ? 'w-24 sm:w-36' : 'w-28 sm:w-48',
    roomRow: compact ? 'h-10' : 'h-14',
    roomName: compact ? 'text-[11px]' : 'text-xs',
    roomLabelPad: compact ? 'p-1' : 'p-2',
    roomNameMl: compact ? 'ml-3' : 'ml-4',
    bookingBar: compact ? 'h-8 top-1' : 'h-11 top-1.5',
    bookingBarText: compact ? 'text-[9px]' : 'text-[10px]',
    bookingBarPinSize: compact ? 10 : 12,
    bookingBarStatusLine: compact ? 'h-0.5' : 'h-1',
    retreatStickyTop: compact ? 'top-9' : 'top-12',
    summaryCell: compact ? 'h-12' : 'h-20',
    summaryText: compact ? 'text-[9px]' : 'text-[10px]',
    teamRow: compact ? 'h-10' : 'h-14',
    teamLabelRow: compact ? 'h-6' : 'h-8',
    teamMemberBar: compact ? 'h-7 top-1.5' : 'h-9 top-2.5',
    addBookingBtn: compact
      ? 'px-1.5 py-1 rounded-lg text-[9px] font-bold'
      : 'px-2 py-2 rounded-xl text-[10px] sm:text-xs font-bold',
    cellPlusSize: compact ? 12 : 14,
  };
}
