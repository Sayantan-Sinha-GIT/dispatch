# Dispatch

A hyperlocal delivery platform in the mould of Blinkit and Zepto: a customer shop, a rider
app and an admin console, driven by a hand-written route optimiser that makes every
assignment automatically.

**Live:** https://dispatch-delivery.vercel.app · Android app built from [`android-app/`](android-app/)

## What it does

| Portal | Who | Highlights |
|---|---|---|
| **Shop** (`/shop`) | Customers | Catalogue with live stock, cart, map pin with Indian landmark search, live order tracking, 3-minute free cancellation, delivery code, support |
| **Rider** (`/rider`) | Riders | Go online, full-screen offers (payout + distance), accept/decline, optimised multi-stop route, Google Maps navigation, background GPS in the app |
| **Console** (`/admin`) | Admin | Live map and order pipeline, plain-English command console (Gemini turns words into validated actions), products and stock, users, support |

- **Dispatch engine:** nearest-neighbour + 2-opt vehicle routing over every pending order and every rider with capacity, a 20 km service radius, 5-minute offers that move on when missed, and penalties for repeated misses.
- **Correct under load:** stock, capacity, cancellation windows and payouts are enforced in Postgres (row-locked functions and triggers), so ten customers racing for the last four items get exactly four orders.
- English and Hindi throughout, light and dark themes, a Data Saver mode for slow networks, and push notifications.

## Stack

Next.js 16 (App Router, TypeScript) · React 19 · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, Storage) · Leaflet + OpenStreetMap · Ola Maps · Google Gemini · Firebase Cloud Messaging · Capacitor 8 (Android) · Vercel · Vitest

## Running locally

```bash
npm install
npm run dev
```

Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. Optional: `GEMINI_API_KEY` (admin console), `OLA_MAPS_API_KEY`
(landmark search), `FIREBASE_SERVICE_ACCOUNT` and `PUSH_WEBHOOK_SECRET` (push).

```bash
npm test        # unit tests (routing solver, pricing, i18n)
npm run lint
```

## How it was built

I built Dispatch with **Claude Code**, Anthropic's AI coding agent, as my pair programmer. I defined the
product (the three portals, the delivery rules, the look and feel), set the constraints (free tiers, a
real Android app, correctness under concurrent orders) and directed every iteration. Claude Code wrote,
tested and deployed the code. [`PRD.md`](PRD.md) records the decisions and why they were made.

## Documentation

[`PRD.md`](PRD.md) describes the product, data model, database invariants, dispatch engine,
deployment and testing in detail.

## License

[MIT](LICENSE) © 2026 Sayantan Sinha
