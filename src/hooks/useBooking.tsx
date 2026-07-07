import React, { createContext, useContext } from 'react';
import { useBookingData } from './useBookingData';
import { Room, Booking, Retreat, RetreatType, GlobalSettings, ConfigOption, UserRecord, VenueHire, TeamPosition, TeamAssignment, CalendarDisplaySettings, MonthlyExpense, ExpenseSpread, RecurringExpense, AccommodationPricing, SeasonalRate, BookingForm } from '@/types';

interface BookingDataContextType {
  rooms: Room[];
  bookings: Booking[];
  deletedBookings: Booking[];
  retreats: Retreat[];
  retreatTypes: RetreatType[];
  teamPositions: TeamPosition[];
  teamAssignments: TeamAssignment[];
  venueHires: VenueHire[];
  deletedVenueHires: VenueHire[];
  bookingTypes: ConfigOption[];
  bookingChannels: ConfigOption[];
  paymentChannels: ConfigOption[];
  expenseCategories: ConfigOption[];
  monthlyExpenses: MonthlyExpense[];
  expenseSpreads: ExpenseSpread[];
  recurringExpenses: RecurringExpense[];
  users: UserRecord[];
  accommodationPricing: AccommodationPricing[];
  seasonalRates: SeasonalRate[];
  bookingForms: BookingForm[];
  settings: GlobalSettings | null;
  calendarDisplaySettings: CalendarDisplaySettings | null;
  loading: boolean;
}

const BookingDataContext = createContext<BookingDataContextType | undefined>(undefined);

export function BookingDataProvider({ children }: { children: React.ReactNode }) {
  const data = useBookingData();
  return (
    <BookingDataContext.Provider value={data}>
      {children}
    </BookingDataContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingDataContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingDataProvider');
  }
  return context;
}
