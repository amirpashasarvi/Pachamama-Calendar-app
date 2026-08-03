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
  /** Public booking site only — rooms sharing this value are shown to guests as one accommodation (e.g. "Stone House Shared"). Admin calendar is unaffected. */
  bookingGroup?: string;
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
  /** Additional payment amounts (excludes deposit). Legacy paidLater1/2 kept in sync on save. */
  payments?: number[];
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
  /** Guest email from public booking site */
  guestEmail?: string;
  guestPhone?: string;
  /** Stripe customer + saved payment method (card on file, charge later) */
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  cardSaved?: boolean;
  /** Slug of the booking form used on the public site */
  formSlug?: string;
  /** Linked retreat run when booked via public retreats flow */
  retreatRunId?: string;
  retreatTypeId?: string;
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
  /** Show this run on the public booking site */
  published?: boolean;
  /** Total retreat price per accommodation anchor (accommodationPricing room id) */
  accommodationPrices?: Record<string, number>;
}

export interface RetreatType {
  id: string;
  name: string;
  /** Public URL slug — e.g. womens-retreat */
  slug?: string;
  description?: string;
  shortDescription?: string;
  photoUrls?: string[];
  /** bookingForms document id */
  bookingFormId?: string;
  published?: boolean;
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

/** Fixed monthly charge (e.g. subscriptions) applied in selected calendar months every year. */
export interface RecurringExpense {
  id: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  amountPerMonth: number;
  active: boolean;
  /** Calendar month numbers 1–12 when this charge applies (repeats every year). */
  monthsOfYear: number[];
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ── Public booking system — Room Pricing (Booking Portal) ──────────────────

export type PricingMode = 'fixed' | 'perGuest';

/**
 * Price for one "accommodation" as shown to guests on the public site.
 * Keyed by a stable anchor roomId (the first room in the group, or the room itself if ungrouped) —
 * so renaming a `bookingGroup` doesn't orphan existing pricing.
 */
export interface AccommodationPricing {
  id: string; // == anchor roomId
  kind: 'group' | 'room';
  /** bookingGroup name (kind = 'group') or room name (kind = 'room') at time of last save — for display only. */
  label: string;
  publicName: string;
  description?: string;
  maxGuests: number;
  pricingMode: PricingMode;
  fixedPrice?: number;
  /** Guest count (as string key, e.g. "1", "2") → price per night. */
  perGuestPrices?: Record<string, number>;
  photos?: { url: string; path: string }[];
  updatedAt?: string;
}

export interface SeasonalRateOverride {
  pricingMode: PricingMode;
  fixedPrice?: number;
  perGuestPrices?: Record<string, number>;
}

export type DayOfWeek = 'Su' | 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa';

export interface SeasonalRate {
  id: string;
  name: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  /** Empty = applies every day of the week. */
  applyDays: DayOfWeek[];
  /** accommodationPricing id → override price for this season. */
  overrides: Record<string, SeasonalRateOverride>;
  updatedAt?: string;
}

// ── Public booking system — Booking Forms (Booking Portal) ───────────────────

export type BookingFormCustomFieldType = 'text' | 'textarea' | 'select';

export interface BookingFormCustomField {
  id: string;
  label: string;
  type: BookingFormCustomFieldType;
  required?: boolean;
  options?: string[];
}

export interface BookingFormDatePeriod {
  startDate: string;
  endDate: string;
}

export interface BookingForm {
  id: string;
  name: string;
  slug: string;
  /** accommodationPricing anchor roomIds included on this form */
  accommodationIds: string[];
  extraIds: string[];
  customFields: BookingFormCustomField[];
  chargeUpfront: boolean;
  saveCardDetails: boolean;
  cancellationPolicyUrl: string;
  minNights: number;
  maxNights: number;
  minAdvanceDays: number;
  maxAdvanceDays: number;
  checkInDays: DayOfWeek[];
  checkOutDays: DayOfWeek[];
  checkInMonthDays: number[];
  checkOutMonthDays: number[];
  fixedCheckIn: string;
  fixedCheckOut: string;
  unavailablePeriods: BookingFormDatePeriod[];
  availablePeriods: BookingFormDatePeriod[];
  hideAvailabilityCalendar: boolean;
  hideGuestAddress: boolean;
  hideCouponForm: boolean;
  openCalendarByDefault: boolean;
  hideCalendarOnMobile: boolean;
  hideAccommodationsUntilSearch: boolean;
  canBookMultiplePeriods: boolean;
  minNightsPerPeriod: number;
  allowBookingRequest: boolean;
  importantBookingInfo: string;
  createdAt?: string;
  updatedAt?: string;
}
