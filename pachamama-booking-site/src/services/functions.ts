import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/services/firebase';

const functions = getFunctions(app, 'us-central1');

export interface SetupIntentResult {
  clientSecret: string;
  setupIntentId: string;
  customerId: string;
}

export interface PublicBookingInput {
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  adults: number;
  kids?: number;
  type: string;
  checkIn: string;
  checkOut: string;
  price: number;
  notes?: string;
  formSlug: string;
  roomIds: string[];
  setupIntentId?: string;
  requireCard?: boolean;
  retreatRunId?: string;
  retreatTypeId?: string;
  accommodationAnchorId?: string;
}

export async function requestSetupIntent(email: string, guestName: string): Promise<SetupIntentResult> {
  const fn = httpsCallable<{ email: string; guestName: string }, SetupIntentResult>(functions, 'createSetupIntent');
  const { data } = await fn({ email, guestName });
  return data;
}

export async function submitPublicBooking(input: PublicBookingInput): Promise<string> {
  const fn = httpsCallable<PublicBookingInput, { bookingId: string }>(functions, 'createPublicBooking');
  const { data } = await fn(input);
  return data.bookingId;
}
