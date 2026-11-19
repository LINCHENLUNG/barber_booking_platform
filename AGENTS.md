# Barberly — project conventions

Barber booking marketplace (course: 抽成制理髮師預約平台). Built on Lovable for M0 v1,
now developed directly in this repo: code → GitHub → Vercel. Lovable is no longer used.

## Stack
- Plain **Vite SPA** (React 19 + React Router + Tailwind v4 + shadcn/ui). No SSR.
- `vercel.json` rewrites every non-`/api` path to `index.html` so `/login` and `/barbers` deep-link.
- Supabase auth via `src/integrations/supabase/client.ts`, reading `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Publishable key only in the browser — never a service-role key.

## Conventions
- Routes live in `src/App.tsx`; pages in `src/pages/*Page.tsx`. M0 routes: `/`, `/login`, `/barbers`.
- React component files are PascalCase (`BarberCard.tsx`); hooks/utils camelCase.
- Role values are exactly `customer` | `shop` | `admin` (sign-up writes only `customer` or `shop`
  into `options.data.role`). Labels may say "Barber"; the value is `shop`.
- Every schema change goes through a Supabase migration; RLS on every table; regenerate
  `src/integrations/supabase/types.ts` after each migration.
- No secrets in commits.
