# PRD: Dispatch — Hyperlocal Delivery Platform

**Status:** v3.4 (current), last revised 2026-09-24. Supersedes v3.3.

Changes since v3.3 (2026-09-24), from a simulated city day (see §7):
- **Checkout refuses addresses no rider covers** (`out_of_area`): no rider's base within the
  20 km radius means nobody could ever deliver it. Such orders used to sit on "finding a rider"
  forever with their stock held.
- **Cancelling a delivered order** (console) now runs through `admin_set_order_status`, so the
  rider's credit is reversed; `apply_order_stock` no longer restocks goods that were delivered
  (`delivered_at` survives the cancellation and marks them as gone).
- **Pulling an order off a stuck rider** (dispatch list button, console `reassign_order`) offers
  it to the nearest *other* rider with room, else the pool. It used to go back to pending, where
  the next tick could hand it straight back to the stuck rider. Only offered/assigned orders
  can be pulled.
- **Suspension hands on the rider's other unaccepted offers** at once, without further penalty,
  instead of letting each time out as one more miss.

Changes since v3.2 (2026-09-24):
- **Background location for online riders** (app 2.3.0): a location foreground service
  (`@capacitor-community/background-geolocation`) keeps sending the rider's position with the
  screen off or the app in the background, with an ongoing "You're online" notification that
  Android requires. Every 25 m, at most every 10 s; stops on going offline or signing out; a
  banner offers Settings if location is refused. Also fixed: the live watch never actually sent
  (a Supabase query that was never awaited), so live rider positions had not been updating.
- **Push notifications** (app 2.2.0): every row in `notifications` also goes to the person's
  phones. Trigger `notifications_push` → pg_net → `/api/push/send` (shared secret from Vault,
  `PUSH_WEBHOOK_SECRET`) → FCM HTTP v1 (`FIREBASE_SERVICE_ACCOUNT`, `src/lib/push.ts`) → tokens
  in `push_tokens`. Offers use a loud heads-up channel, everything else "updates"; tapping opens
  the right screen; sign-out unregisters the phone. Customers now also get "A rider is on the
  way" (with the delivery code) and "Delivered" (trigger `orders_notify_customer`). Firebase
  project = the Google Cloud project `delivery-route-optimizer`; `google-services.json` reaches
  CI as a secret, never the repository.
- **Server region:** functions run in Mumbai (`vercel.json`: bom1), beside Supabase
  (ap-south-1). Checkout went from 3–5 s to under 1 s; the dispatch re-plan runs after the
  response (`after()`).
- Dropped pins are named from OpenStreetMap's road plus Ola's neighbourhood and area; the
  rider's dispatch point shows as an address.
- **Data Saver** (`src/lib/dataSaver.ts`, `DataSaverProvider`, leaf button beside the theme
  toggle): automatic on slow links (ECT 3G or worse, under 1 Mbps, or Save-Data), or pinned
  on/off. The server decides from cookies and Chrome client hints (Accept-CH / Critical-CH) so
  a light page is light from the first byte: photos become drawn artwork (`SaverArt`), product
  photos come as one 384px q35 copy, and looping motion, colour fields and glass blur are off.
  Measured on a 3x phone: landing and sign-in 0 KB of images, shop 332 KB to 89 KB.
- **Landmark search** in the location picker uses Ola Maps (Indian POIs; key in
  `OLA_MAPS_API_KEY`, server-side via `/api/places/*`) with OpenStreetMap as fallback and for
  signed-out visitors.
- Riders choose their start point with GPS or the map (`DepotField`), never by typing
  coordinates. Signing out takes a rider offline.
- Headings use Bricolage Grotesque; body text stays Onest.
- **Fresh start:** the database was reset for launch. Every account except the admin
  (`admin@dispatch.io`), all orders, events, notifications, tickets and logs were removed; the
  product catalog was kept. A JSON backup was taken first, outside the repository.
- Every screen keeps clear of the phone's status and navigation bars (safe-area insets), with a
  solid page-coloured strip behind the status bar.
- The Android app opens on a branded violet splash (logo, wordmark, tagline) that holds until
  the site has loaded.
- The Android app is now a Capacitor app (`android-app/`, version 2.3.0) instead of the
  Bubblewrap TWA. It never shows an address bar, signs in with the phone's own Google
  account sheet, has app-style back-button behaviour, opens links to the site in the app,
  and colours the system bars to match the theme. Same package and signing key, so it
  installs over the old app. See §8.
- Riders get a **Navigate** button on every accepted stop that opens Google Maps directions
  (§ Rider, 11b).
- New `/privacy` and `/terms` pages, linked from the footer.

Changes since v3.1 (2026-09-23):
- Full visual redesign, "lavender field": light theme by default, violet and lime palette,
  the Onest typeface, borderless rounded sheets, pill buttons, and a rebuilt landing page.
  Every portal shares one floating header and one backdrop. See §10.
- New logo, app icons and favicon.
- The GitHub repository is now `Sayantan-Sinha-GIT/dispatch`, and the Vercel project is `dispatch`.


Changes since v3 (2026-09-21 → 22):
- The admin console was redesigned.
- Admins can list, delist and photograph products and edit prices in place.
- Products carry a stock quantity. Orders take from it, cancellations put it back, and the
  shop and cart stop at what is left.
- Customers see the admin's reply to their support requests.
- Every portal has a notification bell.
- Maps are dark in the dark theme.
- The Android APK is built in CI and its signing key is published, so the app opens
  without a URL bar.
- There is a real 404 page.
- A full production QA pass was run.

Changes from v2 to v3:
- One-time codes replaced verification links for sign-up and password reset.
- A 20 km service radius now bounds dispatch and payout.
- Delivery is verified with a code the customer holds, and can be disputed.
- The admin console can set an order's status directly.
- Hosting moved from Netlify to Vercel, and the Netlify site was deleted.
- The interface was rebuilt around photography.

---

## 1. Overview

Dispatch is a working hyperlocal delivery platform in the mould of Blinkit/Zepto,
built as a personal portfolio project. It has three real portals:

| Portal | Who | What they do |
|---|---|---|
| **Shop** | Customer | Browse a catalog, cart, pin a delivery location on a map, place an order, watch it arrive live, cancel inside a grace window, contact support |
| **Rider** | Rider | Go online, receive offers as a full-screen popup showing payout and distance, accept or decline, follow an optimized route, mark delivered, accrue earnings |
| **Console** | Admin | Supervise dispatch, intervene via a natural-language command console, manage the catalog, manage accounts, answer support |

**The engineering centrepiece** is a hand-written vehicle-routing solver
(nearest-neighbour + 2-opt) that runs automatically and owns every assignment
decision. The LLM never routes — it only turns an admin's words into structured
actions, and only against ids the server hands it.

**Non-goals:** real payments, a separately built native UI (the Android app is a native shell around the site), multi-tenant/franchise support,
real courier-API integration.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server components + route handlers |
| Database / Auth / Realtime | Supabase (free tier) | Postgres, RLS, Realtime, service-role admin client |
| Routing algorithm | Hand-written TypeScript | nearest-neighbour + 2-opt, server-side, no solver dependency |
| LLM | Google Gemini (`gemini-3.5-flash-lite`) | Structured output only, for the admin command console |
| Maps | Leaflet + OpenStreetMap | No API key |
| Geocoding | OpenStreetMap Nominatim | Forward search + reverse geocode, no key |
| Distance | Haversine | Straight-line; adequate for a hyperlocal radius |
| Animation | Framer Motion | Route draw, offer popup, counters, transitions |
| i18n | Hand-rolled dictionary + React context | English + Hindi, with `{placeholder}` interpolation |
| Hosting | **Vercel** | Live at `dispatch-delivery.vercel.app` (since 2026-09-22; the old `delivery-route-optimizer-eight.vercel.app` forwards to it). Deploys on push to `master`. Netlify was removed entirely on 2026-09-20 |
| Transactional email | **Brevo SMTP** | Wired into Supabase Auth. Supabase's built-in sender is rate-limited to a handful per hour and is test-only |
| Imagery | 39 WebP assets in `public/images` | Converted from ~70 MB of source PNG to ~3.3 MB. Source art lives in `Images_X`, gitignored |
| File storage | Supabase Storage | Public `product-images` bucket for admin-uploaded product photos, served through `next/image` |
| Android | Capacitor 8 | A native shell that loads the live site, with native Google sign-in. Signed APK built by a GitHub Actions workflow |

---

## 3. Data Model

```
profiles          id (→auth.users), role ('admin'|'rider'|'customer'), name, phone

riders            id, profile_id, capacity, depot_lat/lng, current_lat/lng,
                  location_updated_at, status ('active'|'inactive'),
                  consecutive_missed_offers, suspended_until,
                  total_penalties, total_declines, total_deliveries, total_earnings

products          id, name, category, unit, price, stock_qty,
                  in_stock (generated: stock_qty > 0), is_listed,
                  image_url, image_gradient

orders            id, raw_text, address, lat, lng, weight, status, source,
                  customer_id, assigned_rider_id, sequence_in_route,
                  offered_at, accepted_at, delivered_at,
                  items (jsonb), subtotal, delivery_fee, total_amount,
                  payout_amount, payout_distance_km,
                  delivery_code,
                  cancelled_at, cancelled_by, cancel_reason,
                  disputed_at, dispute_reason, dispute_status

order_events      order_id, event_type, actor_role, actor_id, detail
admin_actions     admin_id, action, target_type, target_id, summary, source, raw_command
support_tickets   customer_id, order_id, subject, message, status, admin_reply
notifications     profile_id, type, title, body, related_order_id, read
optimization_runs run_by, total_distance_before/after, algorithm_used
```

**Order lifecycle:** `pending → offered → assigned → delivered`,
with `expired` (offer timed out or declined) looping back to `pending`/`offered`,
and `cancelled` as a terminal state reachable by customer (within the window) or admin.

### Database invariants enforced in SQL, not just the UI

These are Postgres functions because the UI cannot be trusted to hold them:

- `claim_order_for_rider` — row-locks the rider, re-checks capacity, and performs the
  status transition in one statement. Two concurrent offers to the same rider serialize
  instead of both succeeding. Also persists the quoted payout.
- `accept_order` — single guarded `UPDATE ... WHERE status='offered' AND rider = me`.
- `cancel_my_order` — enforces the 3-minute window and ownership atomically, so it
  cannot race a rider accepting.
- `decline_offer` — releases the offer and increments the decline counter without
  touching the penalty streak.
- `mark_order_delivered` — checks the customer's 4-digit code, credits the *persisted*
  payout so a rider is paid exactly the number their popup showed, and moves the rider
  to the drop they just completed.
- `report_order_not_delivered` — the customer's counter-claim when an order was marked
  delivered but never arrived.
- `admin_set_order_status` — moves an order between states by hand and keeps the rider's
  deliveries and earnings honest in the same transaction: leaving `delivered` un-credits,
  entering it credits.
- `set_my_depot` — a rider relocating their own base.
- `apply_order_stock` (trigger on `orders`) — takes stock when an order is placed and gives
  it back when the order is cancelled, or deleted before delivery; reopening a cancelled
  order takes it again. Delivered goods stay sold, even if the order is cancelled afterwards. Products are locked in id order, so two checkouts for the last unit
  serialize and exactly one succeeds. An order asking for more than is left is refused
  with the product's name and the real count. Being a trigger, it covers every path that
  changes an order — checkout, the customer's cancel, the console, status overrides and
  account deletion — in the same transaction.
- `register_missed_offer` — penalty streak and suspension in one transaction.

**RLS** is on for every table. Customers see only their own orders and only listed
products; riders see only orders assigned to them; admins see everything. The
`product-images` bucket has no write policies at all: uploads go through an admin-checked
route using the service role, so nothing in the browser can write to it. Realtime tables carry
`REPLICA IDENTITY FULL` so RLS can be evaluated against UPDATE/DELETE events.

---

## 4. Auth

Three roles, one `/login` page with role tabs, deep-linkable via `?role=`.

| Role | Methods |
|---|---|
| Customer | Email + password, Google OAuth (one click) |
| Rider | Email + password, Google OAuth; self-signup at `/rider/signup` |
| Admin | Email + password only |

**Sign-in is email + password. The two email steps use one-time codes, not links.**

This reversed an earlier decision, for a concrete reason. A verification link is a
single-use token in a URL, and mail providers follow URLs before the recipient does:
Gmail's scanner consumed a live token **46 seconds** after it was sent, confirmed in
production with `email_confirmed_at` set while `last_sign_in_at` was still null.

For sign-up that is survivable — the scanner's fetch still verifies the address, and
the user signs in afterwards. For password reset it is fatal: the token *is* the
authority to set a new password, so the scanner spends the reset and the user is
locked out holding a link that says "already used".

A typed code cannot be consumed by something that only follows links.

| Flow | Mechanism |
|---|---|
| Sign in | Email + password, or Google OAuth (one click) |
| Sign-up verification | One-time code, entered in the app |
| Password reset | One-time code, entered with the new password |

**Both Supabase email templates must carry `{{ .Token }}` and no `{{ .ConfirmationURL }}`.**
The link and the code are the same one-time token in two forms, so leaving the URL in
lets a scanner burn the code. This project issues **8-digit** codes; OTP length is a
Supabase setting, so no copy states a digit count.

The login screen offers two choices — Continue with Google, Continue with email — and
reveals the email form only on request. Feedback therefore renders *above* that gate:
an OAuth rejection lands with the form shut, and anything inside it would be invisible.

Sign-up runs in the browser rather than through a service-role API call, because only
the client-side `signUp` causes Supabase to send the email at all. A rider's depot and
capacity travel in `user_metadata` and become a `riders` row in `finalizeRole`.

`/auth/callback` still accepts `?code=` and `?token_hash=&type=` for any links already
in flight, and forwards a recovery request it cannot read to `/reset-password`, which
adopts a session handed over in the URL fragment. Fragments never reach the server, so
a route handler alone cannot complete that flow.

Role is assigned once, at first sign-in, by `finalizeRole`, and is never silently
overwritten. A session with no role is signed out rather than guessed at. A role
mismatch returns a **code plus the role actually found**, so the screen can name it in
either language and offer one tap to switch tabs — an English sentence pushed through
a URL could do neither.

---

## 5. Dispatch Engine

**Dispatch is automatic.** There is no "assign this order" step for a human.

One `runDispatchTick()` does two things:
1. Retire offers past the 5-minute acceptance window (penalising repeat no-shows).
2. Run the routing solver across **every** pending order and **every** rider with spare
   capacity, then offer each computed stop.

The tick fires on checkout, when a rider comes online, on a 20-second poll from any
open dashboard, after any console action, and from the admin's manual re-run button.
Every assignment in the system therefore comes out of the solver — nothing is
first-come-first-served.

**Solver:** greedy nearest-depot assignment → nearest-neighbour construction → 2-opt
improvement, compared against a naive round-robin baseline; the shorter candidate wins,
which is why the optimized total can never be reported as worse than the baseline.
Capacity passed to the solver is *remaining* capacity. A rider with a fresh GPS ping is
routed from their live position, otherwise from their depot.

**Acceptance tests** (in `src/lib/routing/optimizer.test.ts`):
no rider exceeds capacity; every order is assigned exactly once; optimized ≤ baseline;
re-running on an unchanged set is stable.

**Service radius:** an order is only ever offered to a rider within
**20 km** (`MAX_OFFER_DISTANCE_KM`). Checkout refuses an address with no rider's base inside
the radius. An order whose nearby riders are all offline or full stays `pending` and shows
the customer "finding a rider" until one frees up. This
is enforced three times over: orders with no rider in range are dropped before routing,
each individual offer re-checks the distance, and the payout function clamps distance
independently. Without it the solver happily planned a Bengaluru rider onto a Kolkata
drop: 1550 km, ₹9361 of payout on a ₹190 basket, and a delivery nobody could make.

**Rider economics:** `₹35 base + ₹12/kg + ₹6/km`, quoted at offer time and *persisted on
the order*, so the accepted figure is the paid figure. Inside the radius the payout
cannot exceed roughly ₹155 + weight.

**Rider position** is whichever is freshest: a GPS ping (valid two minutes), a base the
rider set by hand, or — automatically — the last address they delivered to. A courier who
has just handed over a parcel is standing at that door, so that is where their next job
is measured from.

**Accountability:** 3 consecutive missed offers → 30-minute suspension. Declining is
free and instant (counted separately, no penalty) — going offline is a deliberate
choice, not a miss.

---

## 6. Features by Role

### Customer
1. Catalog with search, category filter, product detail sheet.
2. Cart with quantity controls; server re-prices from the catalog (never trusts client prices) and validates quantities.
   The shop shows "Only N left" at 5 or fewer and follows stock live; Add and the cart's +
   stop at what is left, and a cart asking for more than exists says so before checkout.
3. Map location picker with place search and live reverse-geocoding; structured address fields (flat → street → locality → landmark).
4. Live order tracking: animated progress rail, assigned rider, live rider position on a map, confetti on delivery.
5. **3-minute free-cancellation window** with a live countdown and progress bar; enforced in SQL, not just the UI.
5b. **Delivery code** — a 4-digit number shown the moment a rider is assigned. The rider cannot close the order without it, so "delivered" is something the customer confirms rather than something a rider asserts.
5c. **"I didn't receive this"** — for an order marked delivered that never arrived. It flags the order, raises a support ticket and alerts every admin, who can put it straight back on the road from the console.
6. **Support requests** attached to a specific order, answered by an admin. The order's
   support sheet lists every request with its status and the admin's reply, updating live;
   a reply also lands in the notification bell.
7. Order history with translated statuses.
7b. An empty cart hides the address form and points back to the shop. The "All" category
    chip shows a mosaic of category photos.

### Rider
8. Online/offline toggle; going online immediately pulls waiting work.
9. **Full-screen offer popup** leading with the two numbers that decide the job — **payout** and **distance** — plus weight, address, an expandable fee breakdown, and a countdown ring that turns red in the final minute.
10. Accept or **decline**; declining is free and hands the order straight to the next rider.
11. Optimized multi-stop route on a live map, in sequence.
11b. **Navigate** — every accepted stop has a button that opens Google Maps straight into two-wheeler turn-by-turn directions to the customer's pin, from the rider's current location (the Maps app on a phone, the browser elsewhere). With two or more stops, "Open all N stops in Maps" loads the whole run in delivery order (up to 10 stops, Google's limit). Stop cards show the full address, never truncated.
12. Mark delivered; earnings and lifetime counters credited server-side.
13. Live suspension banner; live GPS streaming while active.
13b. **Location control** — the rider can see exactly where they're being dispatched from and change it: a one-tap GPS ping, or a map picker that moves their base. Previously a rider was stuck at whatever depot they typed at signup, since the only thing that could move them was a browser GPS watch that silently does nothing when permission is denied or the device has no fix.

### Admin
14. Order pipeline: pending → awaiting accept → in progress → delivered, read as one flow with a
    proportional bar beneath, plus riders online and a Live badge that reports the realtime
    socket's actual state.
15. **Command console** — plain-English (or Hindi) instructions:
    - create orders from messy text
    - cancel, delete, or re-plan an order
    - force a specific order to a specific rider
    - mark delivered
    - **set an order's status by hand** (pending / assigned / delivered / cancelled) — the lever for a falsely-delivered order: sending it back to `pending` re-dispatches it *and* removes the delivery and earnings the rider was credited
    - suspend / unsuspend a rider, change capacity
    - re-run dispatch
    - ask questions about current state
    **Destructive actions (cancel / delete / suspend) return a plan and require an explicit
    Apply.** Everything is re-validated server-side against a fresh snapshot, so a
    tampered payload cannot smuggle in an id the admin never saw, and every action is
    written to `admin_actions` with its originating command.
16. Live order board under the map: filter by stage (plus Closed and Disputed), search by
    address, rider named on every order, per-order re-plan and two-tap delete.
17. Rider roster with live GPS freshness, suspension state, load.
18. Products tab: list a new product with its own photo, price and quantity; delist a product
    (hidden from the shop but kept, so it can be listed again); change a photo; edit a price in
    place; set the quantity with − / + or by typing it; a labelled two-tap Delete. The
    catalogue filters by listed / delisted / out of stock, and follows stock live as orders
    come in.
    - `products.stock_qty` (migration v9). At 0 a product is out of stock; `in_stock` is
      generated from the count, so the two can never disagree.
    - `products.is_listed` (migration v8). RLS shows customers listed products only; checkout
      refuses a delisted item still in a cart.
    - Photos go to the public `product-images` Storage bucket through
      `POST /api/admin/products/[id]/image`, admin only. The type is read from the file's first
      bytes (JPEG, PNG or WebP), 5 MB cap, a fresh object name per upload so caches never serve
      the old photo, and the replaced or deleted product's file is removed.
    - A product created with a photo is saved hidden and listed only once the upload succeeds,
      so the shop never shows a half-made listing.
19. **Users tab — delete customer or rider accounts through normal UI controls** (two-tap confirm). Deleting preserves delivery history (orders are anonymised, not destroyed) and releases any in-flight work back to the pool.
20. Support tab — read and resolve tickets with a reply; open tickets are badged on the tab,
    and a failed resolve is reported rather than looking like success.
21. Manual "re-optimize now" override.

### Cross-cutting
22. Dark/light theme, no flash on load.
23. **English + Hindi across every surface**, including status labels, tooltips, placeholders, empty states, error toasts and server error codes (server returns a stable `code`, the client translates it — the server has no locale).
24. Realtime updates everywhere; no manual refresh.
25. PWA manifest + icon set for the Android TWA wrapper.
26. **Notification bell in all three portals** (shop, rider, console), with icons for offers,
    support tickets and replies, cancellations and deliveries. On phones the panel spans the
    screen width so it never runs off the edge.
27. Only `/admin`, `/rider` and `/shop` require sign-in. Unknown paths get a bilingual 404
    page instead of a login redirect.
28. A crash inside any page shows a bilingual "something went wrong" screen with Try again,
    instead of a blank dark page (`app/error.tsx`).
29. Accessibility: the rider's online toggle is a real switch (`role="switch"`,
    `aria-checked`), the bell announces its open state, and form inputs have labels.
    Sheets and modals sit above the map's own controls.

---

## 7. Testing

- **Unit:** 37 tests — routing-solver acceptance properties, plus i18n guards that fail the build if the two locales' key sets diverge, if any translation is empty, or if `{placeholder}` tokens don't match across locales.
- **Multi-actor integration:** five app instances on ports 3000–3004, each served on its **own `*.localhost` subdomain**. This matters: browser cookies are scoped by host and *ignore the port*, so five ports alone share one session — separate subdomains give each role a genuinely independent login.

```
admin.localhost:3000   c1.localhost:3001   c2.localhost:3002
r1.localhost:3003      r2.localhost:3004
```

Verified end-to-end with 2 customers + 2 riders + 1 admin live simultaneously:
auto-dispatch on checkout, distribution across riders, decline-and-rehome, accept,
deliver, payout crediting, customer cancellation, admin console (create / cancel with
confirmation / force-assign / capacity / query), account deletion, support round-trip,
and full Hindi rendering.

**Production QA (2026-09-22).** Scripted browser runs against the live site, using
throwaway accounts that are deleted afterwards:
- **Page sweep, 60/60 clean.** Every page for every role, in both themes, at phone and
  desktop sizes, in English and Hindi, with no console errors, failed requests or
  horizontal scrolling.
- **Order flow, 16/16 steps.** Order → offer → accept → a wrong delivery code is refused →
  the right code delivers → order history → support request → admin reply → the customer
  sees the reply.
- **Product listing, 12/12 checks.** List with a photo; the customer sees it with the photo
  loaded; edit the price; replace the photo; a disguised file is refused (415), as is one
  over 5 MB (413) and a customer's upload (403); delist it, so it leaves the shop and
  checkout refuses it; relist it; a draft stays hidden; deleting the product removes its
  photo.
- **Notification panel.** Fully on screen in every portal at both sizes.

**City simulation (2026-09-24), 44/44 + 5 screen checks.** One admin, five riders
(capacities 2–3) and ten customers across Bengaluru, all through the live API and database
functions (`qa/city.mjs` in the session scratchpad): the admin lists, drafts, publishes,
delists, relists, reprices and restocks products; ten simultaneous checkouts race for the
last four units of one product and exactly four win; a stock ledger (shelf + held by live
orders) balances after every step; every order reaches a rider within 20 km and nobody
exceeds capacity; decline, 5-minute expiry, sign-out and 3-miss suspension each hand the
offer on; customer cancel inside and after the window, double cancel, other customers'
orders; delivery code wrong/right, payout credit, dispute; console cancel, un-cancel (and
un-cancel refused once stock is gone), delete, pull back, force-assign past capacity,
mark delivered and undo; full riders leave orders waiting until a slot frees. The
screens: the admin dashboard shows the city, delist/relist through the real buttons, a
rider accepts in the UI and gets Navigate links, a customer's tracking page.
- **Supabase security advisor.** No new findings.

---

## 8. Deployment

- **Vercel**, deploying on every push to `master`. Netlify was deleted on 2026-09-20.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.
  The anon key is set as **Config**, not Secret: it is compiled into the browser bundle by design.
- **Commit authorship matters.** Vercel refuses any deployment whose commit author it
  cannot match to an account with deploy permission, and it fails as `BLOCKED` rather
  than as a build error — including CLI deploys, which attach the same git metadata.
  This repo's author is pinned to `322015364+Sayantan-Sinha-GIT@users.noreply.github.com`.
- **Keep-alive.** Supabase pauses free projects after about a week without database activity,
  so a Vercel Cron job calls `/api/keep-alive` once a day (a head-only count on `products`).
- **Supabase Auth → URL Configuration**: Site URL is `https://dispatch-delivery.vercel.app`. It must list the production origin (both the new and the old address) and
  `http://localhost:3000/**` under *Redirect URLs*, with the `/**` wildcard.
- **Schema-change checklist** (learned the hard way — these fail *silently* otherwise):
  1. `grant select, insert, update, delete on <table> to service_role;` — tables created by raw SQL do **not** inherit the grants Supabase gives dashboard-created tables.
  2. `alter table <table> replica identity full;` if it is realtime-subscribed under RLS.
  3. `alter publication supabase_realtime add table <table>;`
  4. `notify pgrst, 'reload schema';`

### Android app (Capacitor)
`android-app/` is a Capacitor 8 app (package `com.dispatch.app`) whose web view loads
https://dispatch-delivery.vercel.app, so website changes reach the app without a new APK.
The manual **Android app** GitHub Actions workflow builds it with JDK 21, signs it with the
repository-secret keystore, refuses to publish an APK whose certificate is not the Dispatch
key, and uploads `Dispatch-<version>.apk`. Raise `versionCode`/`versionName` in
`android/app/build.gradle` for each release.

What the shell adds over a browser:
- **No address bar.** Only the site loads in the app; any other link (Google Maps from
  Navigate) is handed to the phone's own app.
- **Native Google sign-in.** `src/lib/nativeApp.ts` detects the app. The login page then
  gets an ID token from the phone's account sheet (`@capgo/capacitor-social-login`) and
  calls `supabase.auth.signInWithIdToken`, followed by `/api/auth/finalize`, the same role
  checks as `/auth/callback`. Google Cloud project *delivery-route-optimizer* holds the web
  client `dispatch-web` (Supabase's, passed as `webClientId`) and the Android client
  `dispatch-android` (package plus the key's SHA-1 `5F:F5:8C:ED:…:B1:E2`).
- **Back button** (`src/components/NativeShell.tsx`): a portal's main screen, home or login
  exits the app; deeper pages step back, or up to their portal when opened from a link.
  Raw history alone looped, because `/` redirects signed-in users forward.
- **App Links:** links to the site open the linked page in the app (`MainActivity`), verified
  by the existing `assetlinks.json`.
- **System bars:** the app's own `DispatchBars` plugin recolours the status and navigation
  bar strips when the theme changes.
- Location permission for riders' GPS and customers' "use my location".

Checked on an Android 15 emulator: no address bar anywhere, the Google account sheet opens,
Navigate launches Google Maps, back and links behave as above, GPS works, and both themes
colour the bars. Google sign-in with a real account needs a phone.

- **Splash** (`MainActivity`, `res/layout/dispatch_splash.xml`): Android's splash shows the logo
  on violet; a matching overlay then lifts the logo, fades in the wordmark and tagline, and holds
  until the first page has loaded (1.3 s minimum, 10 s maximum), so the app never opens blank.
- **Status bar:** the site uses `viewport-fit=cover` and pads itself by `env(safe-area-inset-*)`
  (`--safe-top`/`--safe-bottom` in `globals.css`). On WebView 140+ Capacitor passes the insets
  through (config hint `initialViewportFitValueHint: "cover"`); on older WebViews it pads the
  window instead and the variables are 0.

The earlier Bubblewrap build was removed on 2026-09-24 once Google sign-in was confirmed on a
real phone.

The keystore is kept off the repository. It cannot be replaced: an app signed with one key
can never be updated with another.

---

## 9. Known Limitations

- Distances are straight-line, so ETAs are indicative, not road-accurate.
- Product names, categories and units come from the database in English only; the UI chrome around them is translated.
- Notifications are stored as rendered English text, so a notification written before a language switch stays in the language it was written in.
- No payment capture — `total_amount` is recorded, never charged.
- There is no standing background worker; the dispatch tick rides on open dashboards and on user actions. A production deployment would move it to a scheduled function.
- **Mail-provider link scanning** is why both email flows use codes. Any future flow that puts a single-use token in a URL will hit the same wall.
- **Brevo free tier** allows 300 emails/day. Supabase applies its own hourly cap independently; the lower of the two wins.
- The Hobby Vercel plan is for non-commercial use. Taking real money would require Pro.
- Offers expire only when an open dashboard polls the sweep. If nobody has a dashboard
  open, an unanswered offer stays unanswered.
- After a product photo is replaced, the old file can stay reachable from Supabase's CDN
  cache for a while. The shop never links to it, because every upload gets a new name.

**Deferred until the app goes live.** This is a prototype, and three hardening jobs were
put off on purpose:
1. Rotate the Gemini API key.
2. Move to Supabase's new publishable and secret API keys.
3. Turn on leaked-password protection in Supabase Auth.

---

## 10. Design System

### v4, "lavender field" (2026-09-23)

The previous design was judged too boxy: every panel had a border and the same weight.
The redesign follows the references in `design-inspire/` (not committed): soft sheets
floating on a pale background, very large lightweight type, pills, and a black sheet
for contrast.

| Element | Rule |
|---|---|
| Theme | Light by default. `<html data-theme="light">` is rendered on the server and the boot script switches to dark only for someone who chose it |
| Colour | `brand` violet (#6b4ef0 light, #a996ff dark) for everything the eye should go to; `lime` (#c8f34a) only as a signal (dot, pin, rider fill), never as text on white; `zest` is lime's text-safe olive. The old names `amber`/`cyan` were renamed across the code |
| Type | Onest for headings and body. Page titles are `font-light`, 4xl–6xl, tight tracking |
| Shape | The Tailwind radius scale is raised in `@theme`, so every `rounded-*` got softer at once. Buttons and chips are pills |
| Surfaces | `.sheet` (white, no border, violet shadow), `.sheet-wash` (lavender gradient), `.sheet-ink` (black, used for the rider cockpit, "how it works" and the footer), `.card-soft` (borderless card), `.glass` (frosted bar) |
| Backdrop | `<PageBackground>` / `<Field>`: large blurred colour fields that drift slowly, tinted per portal; replaces the grid and film grain (grain survives only in dark) |
| Photos | The night photographs are turned violet with a `mix-blend-color` layer, so they belong to the palette |
| Shared chrome | `<PortalBar>` (floating glass header on every signed-in page), `<AuthShell>` (photo sheet + form sheet for login, sign-up, reset, onboarding), `<Logo>`/`<LogoMark>` |

The notes below describe v3 and are kept for history.

### v3


Added 2026-09-20, after the interface was judged to look generic. Two causes were
found, and only one of them was about imagery.

**There were no photographs anywhere.** Products carried an `image_gradient` column —
a CSS gradient standing in for a photo — so the shop was twenty coloured rectangles by
design, and `public/` held nothing but icons and leftover framework SVGs.
`products.image_url` was added (nullable, gradient retained as the fallback, because
the admin console can still create a product without artwork and that must degrade to
a colour rather than a broken-image icon).

**Every panel had the same border and the same flat fill**, so nothing led the eye.
That is layout, not imagery, and images alone do not fix it.

| Token | Purpose |
|---|---|
| `.grain` | SVG turbulence film grain. Real Perlin noise: seamless at any size, resolution independent, zero network bytes. Generated noise tiles clump and repeat visibly. Flat dark panels are what make an interface look plastic |
| `.surface-raised-soft` | A light top edge plus a grounded shadow, so panels sit *in front of* the page |
| `.rule-fade` | A hairline that fades at both ends rather than a hard full-width rule |
| `<PageBackground>` | The shared backdrop: corner colour wash, a fading engineering grid, an optional photograph held far back, and grain. Fixed rather than absolute, so long pages do not drag a gradient behind them |

**The hero is dark in both themes.** Its scrims were originally built from `--bg`,
which is near-white under the light theme: the photograph washed out and the headline
became dark text on a dark image. A photographic hero is its own dark surface, so its
wash is a fixed colour and its copy is explicitly light. Only the bottom seam follows
`--bg`, because that edge has to meet the page.

**Art direction, not cropping.** `hero.webp` (16:9) and `hero-mobile.webp` (3:4) are
separate framings served by `<picture>`. Cropping the wide one puts the rider directly
behind the headline on a phone.

**The admin console follows the same system.** It had never had a design pass: five
identical boxes with an emoji each and a column of equally weighted panels. Its header
carries a street-network texture (`.admin-map-texture`, inverted and turned down in the
light theme) and the counts read as one pipeline. Icons are line SVGs in
`components/admin/icons.tsx` — emoji render differently on every platform and cannot take
the theme's colour.

**Maps are dark in the dark theme.** Hosted dark basemaps now all require an API key
(CARTO watermarks its tiles without one), so the stock OpenStreetMap tiles are inverted in
CSS. Only `.leaflet-tile-pane` is filtered, so routes and markers keep their true colours.

**Browser state is read with `useSyncExternalStore`** (`lib/browserState.ts`): the cart,
language and theme. Copying them into React state from an effect rendered twice and is
rejected by the React compiler. The cart snapshot is cached by its stored string, because
a fresh array on every read would re-render forever.
