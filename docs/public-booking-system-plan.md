# Pachamama Public Booking System — Master Plan

> **Status:** Planning agreed — not yet built  
> **Last updated:** 2026-07-02  
> **Owner:** Pachamama Retreat  
> **How to use this doc:** Read before any booking-site work. Update this file when decisions change. Tell Cursor: *“Follow the public booking plan”* or open this file.  
> **Visual reference:** [MangoBeds screenshots](./public-booking-system/references/README.md) (50 images from your current setup)

---

## Vision

Build a **guest-facing booking website** at **`booking.pachamamaretreat.me`** where visitors can book retreats, co-living, and other stay types. Bookings sync **instantly** into the existing admin calendar at **`admin.pachamamaretreat.me`**.

This is a **configurable platform you own and control** — inspired by MangoBeds logic, but not a hardcoded clone. Admin staff configure forms, pricing, extras, coupons, and retreats without touching code.

---

## Architecture (agreed)

| Piece | Location | Notes |
|-------|----------|-------|
| **Admin app** | Current repo (this folder) | Calendar, operations, new admin sections for forms/pricing/promotions |
| **Public booking app** | `pachamama-booking-site/` (new folder, same git repo) | Separate Vite/React build, guest-facing UI |
| **Database** | **Same Firebase project** | Both apps read/write Firestore; bookings appear on calendar in real time |
| **Payments** | Stripe **SetupIntent** (save card, charge later) | Screen guests first; manual charge after approval |
| **Deployment** | Separate deploy targets | Admin → `admin.pachamamaretreat.me`; Public → `booking.pachamamaretreat.me` |

### Why two apps, one Firebase?

- **Security** — guests never see admin routes, other guests’ data, or internal settings
- **Different UX** — admin is dense/operational; public site is clean, fast, mobile-first
- **Independent deploys** — update booking site without touching admin calendar

### Access boundary (confirmed)

| Domain | Access | Purpose |
|--------|--------|---------|
| `admin.pachamamaretreat.me` | You + staff only, login required | Calendar, Settings, Dashboard, Finances — the existing app. Guests never reach this. |
| `booking.pachamamaretreat.me` | Public, no login | Guest-facing booking — **both** retreats and co-living live here, on one site. Booking type is a route/page choice, not a separate domain. |

### One subdomain, not two (confirmed)

Co-living and retreats booking both live on the **same** `booking.pachamamaretreat.me` site, as different pages/routes — not two separate subdomains.

**Why:** one deployment/build/SSL/DNS to maintain, consistent branding across both flows, easy for a guest to move between "Retreats" and "Co-living" without leaving the site, and it matches the Booking Forms model (each form/product is just a new route — no new infrastructure per form).

Two subdomains would only make sense if co-living and retreats were separate brands/products with separate teams — not the case here.

---

## Core design principles

### Keep (MangoBeds-style logic)

| Feature | Detail |
|---------|--------|
| **Booking Forms as templates** | One form (e.g. “Retreats”) defines rules; many retreat packages or products use it |
| **Forms ↔ Retreats connection** | Retreats are created in Retreats module; each retreat links to a booking form (e.g. `Booking Form: Retreats`) |
| **Save card / don’t charge upfront** | Stripe SetupIntent — card on file, charge manually after screening |
| **Long-stay discounts** | Automatic rules (min nights + % + accommodation selection); no code needed by guest |
| **Season-aware pricing** | Per accommodation, high/low season rates like MangoBeds |
| **Extras** | Separate entries per season (e.g. “Extra Kids (3–6) - High Season” vs Low Season) |
| **Coupons** | Full system: expiry, cap, date restrictions, min/max nights, redemption limit, applies to accommodations/extras |
| **Booking request mode** | Optional per form (not forced on retreats) |
| **Form settings** | Restrictions, appearance, advanced, payments — MangoBeds behaviour |

### Skip entirely (Phase 1 and until explicitly requested)

- Monthly selection mode  
- Currency selector / multi-currency  
- Channel manager  
- Coliving.com integration  
- MCP integration  
- Last minute rates  
- iCal sync  
- WhatsApp  
- PDF invoicing  
- Waitlist  

> These can be added later without changing the core architecture.

### Our improvements over MangoBeds

| Feature | Detail |
|---------|--------|
| **Retreats with runs** | One retreat program (e.g. “Waves & Wonders”) with multiple date runs — **already implemented in admin Settings → Our Retreats**. Public site shows **one card**; guest picks from available run dates |
| **Booking source tagging** | `source: "booking-site"` vs `source: "direct"` — visible in statistics |
| **Guest profiles** | Email as unique ID; stay history, room preferences, dietary notes across bookings |
| **Internal notes** | Public bookings land in same calendar with existing notes/comments fields |

---

## Booking types — behaviour

| Type | Check-in / check-out | Rules |
|------|----------------------|-------|
| **Retreat** | Fixed per run | Guest cannot change dates; pricing is **per full retreat** per accommodation type |
| **Co-living** | Flexible | Minimum **2 weeks**; guest chooses check-out |
| **Other forms** | Configurable per form | Defined in Booking Forms admin |

---

## Retreats + Forms relationship

```
Booking Form "Retreats"              Retreat program "Nature Adventure Holiday"
─────────────────────────          ──────────────────────────────────────────
Rules:                               Content:
  min/max nights                      title, description, photos
  which rooms included                fixed dates (via runs)
  payment mode                        pricing per accommodation (total, not /night)
  custom fields                       linked booking form → "Retreats"
  T&C, important notes
```

**Guest flow:** sees retreat page → picks accommodation → dates fixed by chosen run → completes form using linked form rules.

**Admin data model (existing):**

- `retreatTypes` = program (title, e.g. “Women’s Retreat”)
- `retreats` = runs (`retreatTypeId`, `startDate`, `endDate`, `facilitator`, `name`)

Public site will extend this with photos, descriptions, per-run pricing per accommodation.

---

## Room / unit model — decided approach

**We keep the existing individual-room data model** (Stone House Shared 1–6, Campground 1–3, etc.) exactly as it is in the admin calendar. We do **not** rebuild MangoBeds' category → units hierarchy.

**Public display grouping (additive, admin-invisible):**

- New optional field on `Room`: `bookingGroup?: string` (e.g. `"Stone House Shared"`, `"Campground"`)
- Rooms with no `bookingGroup` (private rooms like Ivy, Pomegranate) show individually on the public site
- Rooms sharing a `bookingGroup` are shown to guests as **one card** with aggregate availability, e.g. *"Stone House Shared — 4 of 6 available — €35/night"*
- This field is **only read by the public site** — the admin calendar, room rows, and housekeeping are completely unaffected

**Auto-assignment at booking time:**

- Guest books the group (e.g. "Stone House Shared"), never a specific bed
- A Firestore **transaction** finds an available room in that group for the selected dates and assigns the booking to that specific `roomId`
- Prevents double-booking if two guests try to book the last bed at the same time (whoever's transaction commits first wins; the other sees "just booked, please choose different dates")
- The resulting booking appears in the admin calendar on the assigned specific room, indistinguishable from a manually created booking (tagged `source: "booking-site"`)

**Open item to confirm later:** if a guest wants multiple beds in the same shared group (e.g. a couple), whether that becomes 2 linked bookings under one guest — to be decided when we build this.

---

## Admin navigation — “Booking Portal” (decided approach)

The new admin sections do **not** live inside the existing Settings modal. Settings stays as-is (Rooms, Booking Types, Channels, Team Roster, Our Retreats, etc.) — small, focused config only.

Instead, a **new full-screen dashboard** called **Booking Portal** is added, opened from an icon in the top bar — the same pattern already used for **Dashboard** and **Statistics**.

```
Top bar icons: [Calendar] [Dashboard] [Statistics] [Booking Portal] [Settings] ...
```

Inside Booking Portal, its own internal navigation:

```
Booking Portal
├── Booking Forms
├── Extras
├── Promotions        (Coupons, Long Stay Discounts)
├── Retreats           (public-facing config: photos, description, per-run pricing)
├── Communications      (email templates)
├── Guest Profiles
└── Room Pricing        (per-guest + seasonal rates)
```

A **Calendar icon (or close/back)** inside Booking Portal returns to the normal calendar view — same as Dashboard/Statistics close today.

**Why separate from Settings:** Booking Forms, Coupons, Communications etc. are each a mini-app (multi-tab builders), not simple lists — mixing them into Settings would clutter a currently simple menu and blend two different mental modes (quick operational config vs. guest-facing product configuration).

**Why lower risk:** built as a new, isolated component (e.g. `BookingPortalModal.tsx`), following the “add, never modify existing files” approach already used for this project. `SettingsModal.tsx` is not touched.

| Section | Features |
|---------|----------|
| **Booking Forms** | Create/edit/delete; MangoBeds-style tabs: Information, Custom Fields, Payments & Policies, Restrictions, Appearance, Advanced |
| **Extras** | Name, price, description, image; season-specific entries |
| **Promotions → Coupons** | Full MangoBeds coupon system |
| **Promotions → Long Stay Discounts** | Min nights + % + accommodation selection |
| **Retreats (public-facing config)** | Extend existing runs model: photos, description, per-accommodation pricing per run, link to booking form |
| **Communications** | 4 email templates: confirmed, cancelled, pre-arrival, post-checkout (with variables) |
| **Guest Profiles** | Search guests; full booking history |
| **Room Pricing** | Per-guest pricing + seasonal rates per accommodation |

---

## Public site — pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page — guest chooses **Retreats** or **Co-living** (or other active forms) |
| `/[form-slug]` | Any booking form (co-living, short-stay, etc.) |
| `/retreats` | Grid of retreat programs with available runs |
| `/retreats/[slug]` | Single retreat: run date selector + booking |

---

## Public booking flow (end-to-end)

1. Search dates (or pick retreat run)  
2. Available rooms with prices  
3. Select room + guests  
4. Coupon code + price summary  
5. Guest details + extras  
6. T&C + important notes  
7. **Book Now** → Stripe card save (SetupIntent)  
8. Confirmation email  

Bookings write to Firestore → appear on admin calendar immediately.

---

## Implementation phases

### Phase 1 — Foundation (start here)

1. Room pricing model in Firestore (seasonal rates, per accommodation)  
2. **Booking Forms** manager in admin  
3. First working public form end-to-end (one form, e.g. co-living or simple stay)  
4. Stripe SetupIntent integration  
5. Booking writes to existing `bookings` collection with `source: "booking-site"`  

**Estimated effort (original discussion):** ~3–6 weeks focused work for full system; Phase 1 is a subset.

### Phase 2 — Retreats on public site

1. Public `/retreats` grid using `retreatTypes` + `retreats` runs  
2. Per-run, per-accommodation pricing  
3. Retreat booking flow linked to “Retreats” form  

### Phase 3 — Promotions & extras

1. Extras selection in checkout  
2. Coupons  
3. Long-stay automatic discounts  

### Phase 4 — Guest experience polish

1. Guest profiles (email-linked history)  
2. Email templates (4 types)  
3. Admin guest search  

### Phase 5 — Deferred / later

iCal, WhatsApp, PDF invoicing, multi-currency, last-minute rates, channel manager, waitlist.

---

## Technical notes for developers

- Reuse existing Firestore collections where possible (`bookings`, `rooms`, `retreatTypes`, `retreats`)  
- New collections likely needed: `bookingForms`, `extras`, `coupons`, `longStayDiscounts`, `guestProfiles`, pricing config  
- Firestore rules must distinguish **public write** (limited, validated) vs **admin write**  
- Payment secrets (Stripe) → server-side only (Firebase Functions or similar); never in client bundle  
- Align public site styling with Pachamama brand; keep admin and public visually distinct  

---

## Related admin work already done

- **Retreat programs with runs** — Settings → Our Retreats (`RetreatProgramsPanel`)  
- **Calendar integration** — retreat bars, click-to-edit in settings  
- **Booking/payment channels, commissions** — existing in admin  
- **Block rooms, dashboard, statistics** — operational tooling in place  

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-02 | Initial plan documented from agreed conversation (MangoBeds reference, skip list, improvements, phases) |
| 2026-07-02 | Added 50 MangoBeds reference screenshots under `docs/public-booking-system/references/` |
| 2026-07-02 | Decided room/unit model: keep existing individual rooms, add optional `bookingGroup` field for public display grouping + transaction-based auto-assignment. Confirmed access boundary (admin = staff-only, booking = public) and one-subdomain-with-landing-page decision for co-living vs retreats. |
| 2026-07-02 | Decided admin navigation: new **Booking Portal** full-screen dashboard (top-bar icon, like Dashboard/Statistics) — not folded into Settings. |
| 2026-07-02 | **Renamed** the existing admin app from "Pachamama Booking Management" to **"Pachamama Calendar"** (browser tab, header, login screen, README). New admin section for booking-site config confirmed as **"Booking Portal"**. |

---

## When updating this document

1. Edit the relevant section  
2. Add a row to **Change log**  
3. Update **Last updated** at the top  
4. If a major decision reverses earlier work, note it explicitly under Change log  
