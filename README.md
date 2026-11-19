# Barberly — Barber Booking Platform

A barber / hair-stylist booking marketplace: customers find a stylist and book online; shops list
barbers, services and schedules. v1 (M0) was generated with Lovable and is now developed directly
in this repo.

## M0 scope
- Landing page `/` — serif hero + search, trust logo strip, 4 features, Popular barbers grid.
- `/login` — combined Sign In / Sign Up with a Customer / Barber role tab (`options.data.role` =
  `customer` | `shop`).
- `/barbers` — signed-in, role-aware placeholder shell with Sign Out.

## Development
```sh
npm install
cp .env.example .env   # fill in your Supabase URL + publishable key
npm run dev
```

`npm run build` type-checks and builds the static SPA into `dist/`. `npm test` runs the tests.

## Deploy
Vercel (framework preset: Vite). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in
Vercel → Settings → Environment Variables, then redeploy.
