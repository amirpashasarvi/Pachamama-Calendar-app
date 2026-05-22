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
  channelPaymentBasis: 'bookingPrice' | 'deposit';
  status: BookingStatus;
  source: string;
  bookingChannel: string;
  isVenueHire?: boolean;
  createdAt?: string; // ISO Date
  updatedAt?: string; // ISO Date
  deletedAt?: string; // ISO Date — present when soft-deleted, absent when active
}

export type HousekeepingStatus = 'clean' | 'dirty' | 'inspected';

export interface HousekeepingRecord {
  roomId: string;
  status: HousekeepingStatus;
  cleaned: boolean;
  inspected: boolean;
  lastCheckout: string | null; // ISO Date
  nextCheckin: string | null;  // ISO Date
  lastUpdated: string;        // ISO Date
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
  channelPaymentBasis: 'bookingPrice' | 'deposit';
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
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface TeamPosition {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface TeamAssignment {
  id: string;
  positionId: string;
  positionName: string;
  name: string;
  email: string;
  phone: string;
  contactChannel: 'WhatsApp' | 'Email' | 'Phone' | 'Telegram' | 'Signal';
  roomNotes: string;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  createdAt: string; // ISO Date
}
