# Agent instructions — CrocoTrack

This file is the **agent-facing** copy of project rules (Cursor, Codex, etc.). Humans maintain the same substance in `CLAUDE.md`; update both when changing stack or workflow notes.

Crocodile farm management platform with offline-first architecture, multi-tenant RLS, and onboarding wizard.

## Tech Stack

- **Runtime/Package Manager:** Bun
- **Framework:** React 19 + Vite 7
- **Language:** TypeScript (strict mode, `noUncheckedIndexedAccess`)
- **State:** Zustand (slices pattern, no classes)
- **Server State:** TanStack Query
- **Routing:** React Router v7 (`react-router` package)
- **Validation:** Zod v4
- **UI:** shadcn/ui (base-nova style, `@base-ui/react` primitives) + Tailwind CSS v4
- **Linter/Formatter:** Biome (not ESLint)
- **Testing:** Vitest + React Testing Library + fake-indexeddb
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Offline:** Dexie.js (IndexedDB) + Workbox service worker
- **Icons:** lucide-react
- **Charts:** Recharts
- **Export:** SheetJS (xlsx) + jsPDF
- **Monitoring:** Sentry

## Code Style: FP-Leaning Pragmatic

All code in shared logic (`lib/`, `schemas/`, `constants/`) MUST follow functional programming patterns. Infrastructure edges (stores, hooks, components) are exempt where idiomatic React/Zustand patterns require it.

- No mutable variables (`let`, `var`) in pure logic — use `const` only
- No `.push()` accumulation — use `.map()`, `.filter()`, `.reduce()`, `Array.from()`
- No parameter reassignment — create new `const` bindings instead
- No `while`/`for` loops — use declarative alternatives or recursion
- Separate pure functions from side effects: pure logic in `lib/`, effects in stores/hooks
- Pure functions take all dependencies as parameters (no reaching into module state)
- Prefer `readonly` for types/interfaces where natural
- Use composition (pipe/compose patterns) over class inheritance
- No `class` keyword unless a library requires it
- Result-style error handling where appropriate (not exceptions for control flow)
- React components as pure function components, hooks for side effects

## Committing Changes

Before committing, use the `committing-changes` skill.

## Project Structure

```
src/
  app/          # Layouts, router, providers
  features/     # Feature-sliced: auth, onboarding, farms, pools, settings
    <feature>/
      api/        # Supabase API calls
      components/ # Feature-specific components
      hooks/      # Feature-specific hooks
      pages/      # Route page components
      stores/     # Zustand stores
      types/      # Feature-specific types
  shared/       # Cross-cutting concerns
    components/ui/  # shadcn/ui components
    constants/      # Routes, config
    hooks/          # Shared hooks (useOnlineStatus, useSyncStatus)
    lib/            # Supabase client, Dexie DB, sync engine, utils
    schemas/        # Zod validation schemas
    types/          # Database types (generated), shared types
  test/         # Test setup
supabase/
  migrations/   # SQL migrations
  functions/    # Edge functions
```

## Agent Notes & Surprises

- **Biome, not ESLint:** This project uses Biome 2.4.x for linting and formatting. Do NOT install or configure ESLint. Run `bun run lint` (not `eslint`). Biome config is in `biome.json`.
- **shadcn base-nova style:** shadcn was initialized with the `base-nova` style which uses `@base-ui/react` primitives instead of Radix. Component APIs may differ from shadcn docs/examples online. Always read the actual component files in `src/shared/components/ui/` before using them.
- **`form` and `steps` components unavailable:** These shadcn components don't exist in the base-nova registry. Forms use manual state management with Zod validation.
- **Zod v4:** This project uses Zod v4 (`^4.3.6`), not v3. API is mostly compatible but some methods differ (e.g., `z.email()` instead of `z.string().email()`).
- **Tailwind CSS v4:** Uses `@theme inline` blocks in CSS, not `tailwind.config.js`. The `@tailwindcss/vite` plugin is used instead of PostCSS.
- **No pg_uuidv7 on Supabase hosted:** The `pg_uuidv7` extension is not available. All UUIDs use `gen_random_uuid()` instead.
- **IPv6 connectivity:** `supabase db push` fails due to IPv6 routing issues. Run migrations via the Supabase SQL Editor in the dashboard instead.
- **Supabase project ref:** `pfvpvbagrarwmioepupz`
- **`next-themes` dependency:** Required by the sonner/Toaster component. `Providers` wraps the app in `ThemeProvider` to prevent runtime errors.
- **`"use client"` directives:** Some shadcn components have `"use client"` directives — these are harmless in a Vite SPA (no RSC) but are dead code.
- **Path alias:** `@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`).
- **All UI strings are hardcoded in Spanish** (Colombia-only MVP). No i18n library is used.
- **`SelectValue` (Base UI):** Pass a **function child** `(value) => ReactNode` so the trigger shows the right label (e.g. resolve name from `value`). A zero-arg `() => label` also works but prefer `(value) =>` when the label must track the selected id. Otherwise the trigger may show the raw value.
- **Farm routing:** `/farms/:farmId/*` — `FarmLayout`/`SettingsLayout` wrap `AppShell`. `navLinkClass` exported from `AppShell`. Use `useFarmStore.getState()` in async callbacks (avoid stale closure on `lastFarmId`).
