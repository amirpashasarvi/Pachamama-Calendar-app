export const COMPACT_CALENDAR_STORAGE_KEY = 'pachamama-calendar-compact';

/** false = default density; true = extra-compact (checkbox on) */
export function loadCompactCalendarPreference(): boolean {
  try {
    const stored = localStorage.getItem(COMPACT_CALENDAR_STORAGE_KEY);
    if (stored === null) return false;
    // Legacy: "true" was the former compact tier, which is now the default (false).
    if (stored === 'true') {
      localStorage.setItem(COMPACT_CALENDAR_STORAGE_KEY, 'false');
      return false;
    }
    return stored === 'true';
  } catch {
    return false;
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

/** compact=true → extra-compact tier; compact=false → default (former compact sizing) */
export function calendarLayoutClasses(compact: boolean) {
  return {
    appHeader: compact ? 'h-10' : 'h-11',
    appHeaderMinH: compact ? 'min-h-10' : 'min-h-11',
    appHeaderPx: compact ? 'px-3' : 'px-4',
    appTitle: compact ? 'text-base' : 'text-lg',
    appTitleClass: compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base',
    appIconBtn: compact ? 'p-1' : 'p-1.5',
    appIconSize: compact ? 14 : 16,
    calHeaderRow: compact ? 'h-8' : 'h-10',
    monthBtn: compact
      ? 'px-1.5 py-0.5 rounded text-[10px] font-bold transition-all'
      : 'px-2 py-0.5 rounded text-xs font-bold transition-all',
    todayBtn: compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1',
    navChevronSize: compact ? 10 : 12,
    navYearText: compact ? 'text-[10px]' : 'text-xs',
    navIconSize: compact ? 12 : 14,
    dateHeaderRow: compact ? 'h-7' : 'h-9',
    dateHeaderWeekday: compact ? 'text-[7px]' : 'text-[8px]',
    dateHeaderDayNum: compact ? 'text-[10px]' : 'text-xs',
    roomLabelCol: compact ? 'w-20 sm:w-28' : 'w-24 sm:w-36',
    roomRow: compact ? 'h-8' : 'h-10',
    roomName: compact ? 'text-[10px]' : 'text-[11px]',
    roomLabelPad: compact ? 'p-0.5' : 'p-1',
    roomNameMl: compact ? 'ml-2.5' : 'ml-3',
    bookingBar: compact ? 'h-6 top-0.5' : 'h-8 top-1',
    bookingBarText: compact ? 'text-[8px]' : 'text-[9px]',
    bookingBarContentPad: compact ? 'pb-0' : 'pb-0.5',
    bookingBarPinSize: compact ? 8 : 10,
    bookingBarStatusLine: 'h-1',
    retreatStickyTop: compact ? 'top-7' : 'top-9',
    summaryCell: compact ? 'h-10' : 'h-12',
    summaryText: compact ? 'text-[8px]' : 'text-[9px]',
    summaryLabelText: compact ? 'text-[9px]' : 'text-[10px]',
    summaryIconSize: compact ? 7 : 8,
    teamRow: compact ? 'h-8' : 'h-10',
    teamLabelRow: compact ? 'h-5' : 'h-6',
    teamLabelPad: compact ? 'px-1.5' : 'px-2',
    teamMemberBar: compact ? 'h-5 top-1' : 'h-7 top-1.5',
    addBookingBtn: compact
      ? 'px-1 py-0.5 rounded-md text-[8px] font-bold'
      : 'px-1.5 py-1 rounded-lg text-[9px] font-bold',
    addBookingPlusSize: compact ? 8 : 10,
    cellPlusSize: compact ? 10 : 12,
  };
}
