# Pachamama Booking Management

Booking management for Pachamama — rooms, calendar, housekeeping, venue hires, retreats, and team assignments.

## Run Locally

**Prerequisites:** Node.js 22 or newer

1. Install dependencies:
   `npm install`
2. Start the development server:
   `npm run dev`

## Deploy

The app is configured for Netlify:

1. Connect this GitHub repo to Netlify.
2. Use `npm run build` as the build command.
3. Use `dist` as the publish directory.
4. Add the Netlify domain to Firebase Authentication authorized domains.

## Access Control

New Google sign-ins create a `pending` profile. An existing administrator must promote approved users to `staff` or `admin` before they can access operations data.
