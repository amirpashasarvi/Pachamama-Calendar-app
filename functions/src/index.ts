import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Stripe from 'stripe';

initializeApp();
const db = getFirestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function findAvailableRoom(roomIds: string[], checkIn: string, checkOut: string): Promise<string | null> {
  for (const roomId of roomIds) {
    const snap = await db.collection('bookings').where('roomId', '==', roomId).get();
    const busy = snap.docs.some(doc => {
      const data = doc.data();
      if (data.deletedAt) return false;
      if (data.lifecycleStatus === 'cancelled') return false;
      return datesOverlap(data.checkIn, data.checkOut, checkIn, checkOut);
    });
    if (!busy) return roomId;
  }
  return null;
}

interface PublicBookingPayload {
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

function validatePayload(data: PublicBookingPayload) {
  if (!data.guestName?.trim() || data.guestName.length > 200) {
    throw new HttpsError('invalid-argument', 'Invalid guest name.');
  }
  if (!data.guestEmail?.trim() || !data.guestEmail.includes('@') || data.guestEmail.length > 150) {
    throw new HttpsError('invalid-argument', 'Invalid email.');
  }
  if (!data.checkIn || data.checkIn.length !== 10 || !data.checkOut || data.checkOut.length !== 10) {
    throw new HttpsError('invalid-argument', 'Invalid dates.');
  }
  if (data.checkIn >= data.checkOut) {
    throw new HttpsError('invalid-argument', 'Check-out must be after check-in.');
  }
  if (!Array.isArray(data.roomIds) || data.roomIds.length === 0) {
    throw new HttpsError('invalid-argument', 'No rooms specified.');
  }
  if (typeof data.price !== 'number' || data.price < 0 || data.price > 100000) {
    throw new HttpsError('invalid-argument', 'Invalid price.');
  }
  if (typeof data.adults !== 'number' || data.adults < 1 || data.adults > 20) {
    throw new HttpsError('invalid-argument', 'Invalid guest count.');
  }
}

async function validateRetreatBooking(data: PublicBookingPayload) {
  if (!data.retreatRunId || !data.retreatTypeId || !data.accommodationAnchorId) {
    throw new HttpsError('invalid-argument', 'Retreat booking requires run, program, and accommodation.');
  }

  const [runSnap, typeSnap] = await Promise.all([
    db.collection('retreats').doc(data.retreatRunId).get(),
    db.collection('retreatTypes').doc(data.retreatTypeId).get(),
  ]);

  if (!runSnap.exists || !typeSnap.exists) {
    throw new HttpsError('not-found', 'Retreat not found.');
  }

  const run = runSnap.data()!;
  const program = typeSnap.data()!;

  if (run.retreatTypeId !== data.retreatTypeId) {
    throw new HttpsError('invalid-argument', 'Retreat run does not match program.');
  }
  if (run.published === false || program.published === false) {
    throw new HttpsError('failed-precondition', 'This retreat is not available for booking.');
  }
  if (run.startDate !== data.checkIn || run.endDate !== data.checkOut) {
    throw new HttpsError('invalid-argument', 'Dates must match the selected retreat run.');
  }

  const expectedPrice = run.accommodationPrices?.[data.accommodationAnchorId];
  if (typeof expectedPrice !== 'number' || expectedPrice !== data.price) {
    throw new HttpsError('invalid-argument', 'Price does not match retreat pricing.');
  }

  const formId = program.bookingFormId as string | undefined;
  if (formId) {
    const formSnap = await db.collection('bookingForms').doc(formId).get();
    if (formSnap.exists) {
      const form = formSnap.data()!;
      const allowed = (form.accommodationIds as string[]) ?? [];
      if (!allowed.includes(data.accommodationAnchorId)) {
        throw new HttpsError('invalid-argument', 'Accommodation not allowed for this retreat.');
      }
    }
  }
}

/** Returns a Stripe SetupIntent client secret so the guest can save a card on file. */
export const createSetupIntent = onCall(
  { secrets: [stripeSecretKey], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const email = String(request.data?.email ?? '').trim();
    const guestName = String(request.data?.guestName ?? '').trim();
    if (!email || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Valid email required.');
    }

    const stripe = new Stripe(stripeSecretKey.value());
    const customer = await stripe.customers.create({ email, name: guestName || undefined });
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: { source: 'booking-site' },
    });

    if (!setupIntent.client_secret) {
      throw new HttpsError('internal', 'Could not create payment setup.');
    }

    return {
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: customer.id,
    };
  },
);

/** Creates a public booking with optional card-on-file verification. */
export const createPublicBooking = onCall(
  { secrets: [stripeSecretKey], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const data = request.data as PublicBookingPayload;
    validatePayload(data);

    if (data.retreatRunId) {
      await validateRetreatBooking(data);
    }

    let stripeCustomerId: string | undefined;
    let stripePaymentMethodId: string | undefined;
    let cardSaved = false;

    if (data.requireCard) {
      if (!data.setupIntentId) {
        throw new HttpsError('invalid-argument', 'Payment setup required.');
      }
      const stripe = new Stripe(stripeSecretKey.value());
      const setupIntent = await stripe.setupIntents.retrieve(data.setupIntentId);
      if (setupIntent.status !== 'succeeded') {
        throw new HttpsError('failed-precondition', 'Card was not saved. Please try again.');
      }
      stripeCustomerId = typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id;
      stripePaymentMethodId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;
      if (!stripeCustomerId || !stripePaymentMethodId) {
        throw new HttpsError('failed-precondition', 'Payment method not found.');
      }
      cardSaved = true;
    }

    const roomId = await findAvailableRoom(data.roomIds, data.checkIn, data.checkOut);
    if (!roomId) {
      throw new HttpsError('failed-precondition', 'Sorry, this accommodation was just booked. Please choose different dates.');
    }

    const kids = data.kids ?? 0;
    const bookingRef = db.collection('bookings').doc();
    const now = new Date().toISOString();

    await bookingRef.set({
      guestName: data.guestName.trim(),
      guestEmail: data.guestEmail.trim(),
      guestPhone: data.guestPhone?.trim() || '',
      additionalNames: '',
      adults: data.adults,
      kids,
      totalGuests: data.adults + kids,
      type: data.type,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      roomId,
      bedSetting: 'Double',
      dietary: '',
      singleBeds: 0,
      doubleBeds: 0,
      notes: data.notes ?? '',
      comments: '',
      price: data.price,
      extras: [],
      deposit: 0,
      paidLater1: 0,
      paidLater2: 0,
      status: 'Unpaid',
      bookingChannel: 'Direct',
      source: 'booking-site',
      formSlug: data.formSlug,
      cardSaved,
      ...(data.retreatRunId ? { retreatRunId: data.retreatRunId } : {}),
      ...(data.retreatTypeId ? { retreatTypeId: data.retreatTypeId } : {}),
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
      ...(stripePaymentMethodId ? { stripePaymentMethodId } : {}),
      createdAt: now,
    });

    return { bookingId: bookingRef.id };
  },
);
