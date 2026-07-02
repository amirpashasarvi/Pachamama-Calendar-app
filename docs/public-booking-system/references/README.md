# MangoBeds reference screenshots

Visual reference from Pachamama’s current MangoBeds setup (July 2026). Use alongside [`../public-booking-system-plan.md`](../public-booking-system-plan.md) when designing the public booking system.

**Note:** These show how MangoBeds works today — not necessarily exact copy. The agreed plan keeps MangoBeds logic where noted, with Pachamama-specific improvements (retreat runs, guest profiles, etc.).

---

## 01 — Overview & navigation

| File | Shows |
|------|--------|
| `01-overview-01-*.png` | MangoBeds calendar + left sidebar (Bookings, Accommodations, Forms, Extras, Promotions, Communications, Settings) |

---

## 02 — Accommodations (room pricing)

| Files | Shows |
|-------|--------|
| `02-accommodations-01` through `06` | Room categories/units, per-guest nightly rates, seasonal rate setup (High Season May–Oct) |

**Key patterns:** Campground units, Stone House shared beds, private rooms; 1–4 guest price tiers; season overrides per accommodation.

---

## 03 — Booking forms (admin config)

| Files | Shows |
|-------|--------|
| `03-booking-forms-01` through `11` | Form list + tabs: Information, Restrictions, Extras, Payments, Custom Fields, Appearance, Advanced |

**Example forms in use:** Pachamama Coliving (min 14 nights), Coliving Short Stay, Retreats, Festival.

**Key settings:** min/max nights, check-in/out allowed days, fixed dates for retreats, save-card payment mode, T&C URLs, important notes, coupon visibility.

---

## 04 — Extras, promotions & communications

| Files | Shows |
|-------|--------|
| `04-extras-promotions-comms-01` through `12` | Extras list, coupon editor, long-stay discounts, email templates |

**Extras:** season-specific entries (e.g. Extra Kids 3–6 High/Low Season).

**Coupons:** % discount, cap, date restrictions, min/max nights, redemption limit, applies to accommodations/extras.

**Long stay:** automatic discounts (e.g. 28+ nights 20%, 84+ nights 30%).

**Communications:** confirmed, cancelled, pre-arrival, post-checkout templates with variables.

---

## 05 — Retreats module

| Files | Shows |
|-------|--------|
| `05-retreats-module-01` through `11` | Retreat packages list, create/edit, photos, per-accommodation **total** pricing, public grid preview |

**Key pattern:** Retreat content (title, dates, pricing) is separate from the linked booking form rules.

**Our improvement:** one retreat program with multiple **runs** (see plan doc) instead of cloning duplicate cards.

---

## 06 — Guest booking flow (public)

| Files | Shows |
|-------|--------|
| `06-guest-booking-flow-01` through `08` | MangoBeds preview + embedded flow on pachamamaretreat.me: search → rooms/prices → summary → guest details → extras → payment |

**Flow order:** dates/guests → available rooms with prices → room + guest count → coupon + summary → guest details → extras → T&C → Stripe card save → confirmation.

---

## 07 — Retreat ↔ form connection

| File | Shows |
|------|--------|
| `07-retreat-form-link-01-*.png` | Retreat edit screen with **Booking Form: Retreats** dropdown — forms and retreats are linked, not merged |

---

## Adding more references

When you share new MangoBeds screenshots:

1. Save PNG into this folder with prefix `08-…`, `09-…`, etc.
2. Add a row to the matching section above
3. Update the change log in `public-booking-system-plan.md`
