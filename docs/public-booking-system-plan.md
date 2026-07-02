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
| **Room/unit model** | Categories with units (Campground 1/2/3, Stone House shared beds, etc.) |
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

## Admin app — new sections to build

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

---

## When updating this document

1. Edit the relevant section  
2. Add a row to **Change log**  
3. Update **Last updated** at the top  
4. If a major decision reverses earlier work, note it explicitly under Change log  
