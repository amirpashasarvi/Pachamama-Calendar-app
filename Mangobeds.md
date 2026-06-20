# Mangobeds — setup guide

You received the **Pachamama Booking Management** codebase. Follow these steps to run it locally, sign in as admin, customize it, and deploy it for your own use.

This zip is **yours to keep and modify**. It is not wired to the original owner’s live data — you will connect it to **your own Firebase project**.

---

## Quick start (about 20 minutes)

### 1. Install and open the project

**Requirements:** Node.js 22+

```bash
unzip pachamama-booking-calendar-share.zip
cd pachamama-booking-calendar-share   # folder name may vary after unzip
npm install
```

### 2. Create your Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. **Create a project** (any name you like)
3. Enable **Firestore Database** (production mode is fine; you will publish rules next)
4. Enable **Authentication** → Sign-in method → **Google** → Enable

### 3. Register a web app

1. Project settings → **Your apps** → Add app → **Web**
2. Copy the Firebase config values
3. In this project folder:

```bash
cp firebase-applet-config.example.json firebase-applet-config.json
```

4. Edit `firebase-applet-config.json` and paste your values (`projectId`, `apiKey`, `authDomain`, etc.)

### 4. Publish Firestore security rules

Install Firebase CLI if needed: `npm install -g firebase-tools`

```bash
firebase login
firebase use --add          # select your new project
firebase deploy --only firestore:rules
```

The rules file is `firestore.rules` in this repo. **Do not skip this step** — without published rules, reads/writes will fail.

### 5. Create your admin user (before first login)

The app only allows **pre-approved** Google accounts. Add yourself in Firestore **before** signing in:

1. Firebase Console → **Firestore Database** → **Start collection**
2. Collection ID: `users`
3. Document ID: your Google email in **lowercase** (e.g. `you@gmail.com`)
4. Fields:

| Field | Type | Value |
|-------|------|-------|
| `email` | string | your Google email (lowercase) |
| `name` | string | your display name |
| `role` | string | `admin` |
| `uid` | string | *(leave empty)* |
| `createdAt` | string | e.g. `2026-06-17T12:00:00.000Z` |

### 6. Run the app

```bash
npm run dev
```

Open **http://localhost:3000** → **Sign in with Google** with the same email you added in step 5.

You should have full admin access (calendar, Settings, Finances, etc.) on an **empty** database you own.

---

## Deploy to the web (optional)

### Netlify (matches the original setup)

1. Push the code to **your** GitHub repo
2. [Netlify](https://www.netlify.com/) → New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Firebase Console → Authentication → **Authorized domains** → add your Netlify URL (e.g. `your-app.netlify.app`)

---

## Customize for your use

| Area | Where to look |
|------|----------------|
| Branding / title | `src/App.tsx`, `index.html` |
| Rooms, booking types, channels | Settings in the app (after login) |
| Calendar layout | `src/lib/calendarLayout.ts`, `src/components/calendar/` |
| Finances / expenses | `src/components/modals/DashboardModal.tsx`, Settings |
| Security rules | `firestore.rules` → redeploy after changes |

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | TypeScript check |
| `firebase deploy --only firestore:rules` | Publish rule changes |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| “Your account is not authorized” | Add your Google email to Firestore `users/{email}` with `role: admin` **before** signing in |
| “Permission denied” | Run `firebase deploy --only firestore:rules` |
| “Unauthorized domain” on login | Add `localhost` (or your deploy URL) in Firebase → Authentication → Authorized domains |
| Empty calendar | Normal on a new project — add rooms in **Settings → Rooms** |

---

## What is not included (by design)

- The original owner’s Firebase project, bookings, or customer data
- Firebase Admin service account keys (`scripts/keys/*.json`)
- Netlify or GitHub access to the owner’s accounts

You own your Firebase project and your deployment. The code is yours to change and ship.

---

## Optional: seed sample data

After login, use **Settings** to add rooms, booking types, and channels, then create bookings on the calendar. No migration scripts are required for a fresh start.

If you need help, contact the person who sent you this zip.
