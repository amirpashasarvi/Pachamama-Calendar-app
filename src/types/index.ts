export type RoomType = 
  | 'Shared Room' 
  | 'Private Room' 
  | 'Glamping Tent' 
  | 'Campground' 
  | 'Treehouse' 
  | 'Venue Hire' 
  | 'Home Exchange';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  guestCount: number;
  additionalBeds: number;
  singleBeds: number;
  doubleBeds: number;
  description: string;
  equipment: string;
  size: string;
  color: string;
  order: number;
}

export type BookingStatus = 'Paid' | 'Partial' | 'Unpaid';

export type LifecycleStatus = 'active' | 'cancelled';

export interface Comment {
  author: string;
  text: string;
  timestamp: string;
}

export interface ConfigOption {
  id: string;
  name: string;
  color: string;
  commission?: number;
  sortOrder?: number;
}

export interface Booking {
  id: string;
  guestName: string;
  additionalNames: string;
  adults: number;
  kids: number;
  totalGuests: number;
  type: string; // Retreat, Coliving, etc.
  checkIn: string; // ISO Date
  checkOut: string; // ISO Date
  roomId: string;
  bedSetting: 'Double' | 'Twin';
  dietary: string;
  singleBeds: number;
  doubleBeds: number;
  notes: string;
  comments: string;
  price: number;
  extras: { label: string; amount: number }[];
  deposit: number;
  paidLater1: number;
  paidLater2: number;
  bookingChannelBasis?: 'bookingPrice' | 'deposit' | 'custom';
  bookingChannelCustomAmount?: number;
  paymentChannelBasis?: 'bookingPrice' | 'remaining' | 'custom';
  paymentChannelCustomAmount?: number;
  /** @deprecated — use bookingChannelBasis / paymentChannelBasis */
  channelPaymentBasis?: 'bookingPrice' | 'deposit' | 'custom';
  /** @deprecated */
  commissionCustomAmount?: number;
  status: BookingStatus;
  lifecycleStatus?: LifecycleStatus;
  cancelledAt?: string;
  cancellationReason?: string;
  bookingChannel: string;
  paymentChannel?: string;
  source: string;
  isVenueHire?: boolean;
  createdAt?: string; // ISO Date
  updatedAt?: string; // ISO Date
  deletedAt?: string; // ISO Date — present when soft-deleted, absent when active
  commentsUpdatedAt?: string; // ISO Date — set when staff save a comment
}

// 'cleaned' = room cleaned, awaiting final inspection
// 'inspected' kept for backward-compat with existing Firestore records (treated as 'cleaned')
export type HousekeepingStatus = 'clean' | 'dirty' | 'cleaned' | 'inspected';

export interface HousekeepingHistoryEntry {
  action: string;
  timestamp: string; // ISO
  userName: string;
}

export interface HousekeepingRecord {
  roomId: string;
  status: HousekeepingStatus;
  cleaned: boolean;
  inspected: boolean;
  lastCheckout: string | null; // ISO Date
  nextCheckin: string | null;  // ISO Date
  lastUpdated: string;         // ISO Date
  assignedTo?: string;         // staff name
  cleanedBy?: string;          // name of staff who marked room cleaned
  inspectedBy?: string;        // name of staff who marked room inspected & ready
  notes?: string;
  notesUpdatedAt?: string;     // ISO — set when notes are saved, used for admin alerts
  history?: HousekeepingHistoryEntry[];
}

export interface Retreat {
  id: string;
  retreatTypeId: string;
  name: string; // Retreat Name (copied from retreat type)
  startDate: string;
  endDate: string;
  facilitator: string;
  createdAt?: string;
}

export interface RetreatType {
  id: string;
  name: string;
}

export interface VenueHire {
  id: string;
  name: string;
  organizer: string;
  startDate: string;
  endDate: string;
  guestCount: number;
  notes: string;
  roomNotes: { [roomId: string]: string };
  bookingPrice: number;
  deposit: number;
  extras: { label: string; amount: number }[];
  paidLater1: number;
  paidLater2: number;
  bookingChannel: string;
  paymentChannel?: string;
  bookingChannelBasis?: 'bookingPrice' | 'deposit' | 'custom';
  bookingChannelCustomAmount?: number;
  paymentChannelBasis?: 'bookingPrice' | 'remaining' | 'custom';
  paymentChannelCustomAmount?: number;
  /** @deprecated */
  channelPaymentBasis?: 'bookingPrice' | 'deposit' | 'custom';
  /** @deprecated */
  commissionCustomAmount?: number;
  lifecycleStatus?: LifecycleStatus;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string; // ISO Date — present when soft-deleted, absent when active
}

export interface GlobalSettings {
  bookingTypes: string[];
  bookingSources: string[];
}

export interface CalendarDisplayField {
  id: string;
  label: string;
  enabled: boolean;
}

export interface CalendarDisplaySettings {
  bookingBarFields: CalendarDisplayField[];
  teamRosterBarFields: CalendarDisplayField[];
}

export type UserRole = 'admin' | 'staff';

export interface UserProfile {
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
}

export interface UserRecord {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
}

export interface TeamPosition {
  id: string;
  name: string;
  color: string;
  order: number;
}

export type ActivityAction = 'created' | 'updated' | 'deleted' | 'restored' | 'cancelled' | 'reactivated';
export type ActivityEntityType = 'booking' | 'venueHire';

export interface ActivityLogEntry {
  id?: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  summary: string;
  userName: string;
  userEmail: string;
  timestamp: string;
}

export interface TeamAssignment {
  id: string;
  positionId: string;
  positionName: string;
  name: string;
  accommodation: string;
  notes: string;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  createdAt: string; // ISO Date
  /** @deprecated legacy field — read-only fallback */
  roomNotes?: string;
}

/** Monthly expense totals keyed by expense category id (Settings → Expense Categories). */
export interface MonthlyExpense {
  id: string; // YYYY-MM
  month: string; // YYYY-MM
  /** Manual totals for this month (e.g. from Spendee). */
  amounts: Record<string, number>;
  /** Amounts allocated from annual/multi-month spreads. */
  spreadAmounts?: Record<string, number>;
  /** categoryId → expenseSpreads doc id */
  spreadIds?: Record<string, string>;
  /** Snapshot of category names at save time — used when a category is later removed. */
  categoryLabels?: Record<string, string>;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Even split of one payment across multiple months (e.g. annual tax). */
export interface ExpenseSpread {
  id: string;
  year: number;
  categoryId: string;
  categoryLabel: string;
  totalAmount: number;
  months: string[];
  perMonth: Record<string, number>;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}
