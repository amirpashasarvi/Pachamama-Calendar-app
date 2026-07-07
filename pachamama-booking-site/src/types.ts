export type DayOfWeek = 'Su' | 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa';
export type PricingMode = 'fixed' | 'perGuest';

export interface Room {
  id: string;
  name: string;
  guestCount: number;
  bookingGroup?: string;
  order: number;
}

export interface AccommodationPricing {
  id: string;
  kind: 'group' | 'room';
  label: string;
  publicName: string;
  description?: string;
  maxGuests: number;
  pricingMode: PricingMode;
  fixedPrice?: number;
  perGuestPrices?: Record<string, number>;
}

export interface SeasonalRate {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  applyDays: DayOfWeek[];
  overrides: Record<string, {
    pricingMode: PricingMode;
    fixedPrice?: number;
    perGuestPrices?: Record<string, number>;
  }>;
}

export interface BookingFormCustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required?: boolean;
  options?: string[];
}

export interface BookingForm {
  id: string;
  name: string;
  slug: string;
  accommodationIds: string[];
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
  hideCouponForm: boolean;
  importantBookingInfo: string;
}

export interface RetreatType {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  photoUrls?: string[];
  bookingFormId?: string;
  published?: boolean;
}

export interface RetreatRun {
  id: string;
  retreatTypeId: string;
  name: string;
  startDate: string;
  endDate: string;
  facilitator: string;
  published?: boolean;
  accommodationPrices?: Record<string, number>;
}

export interface Booking {
  id: string;
  guestName: string;
  adults: number;
  kids: number;
  checkIn: string;
  checkOut: string;
  roomId: string;
  type: string;
  price: number;
  deposit: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  bookingChannel: string;
  source: string;
  deletedAt?: string;
  lifecycleStatus?: string;
}
