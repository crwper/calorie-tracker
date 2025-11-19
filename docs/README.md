# Snack Dragon – Engineering Notebook (`docs/`)

This folder collects lightweight, living docs for platform features and implementation plans.

## Table of Contents

- [Realtime Sync Plan (Across Devices & Tabs)](./realtime-sync-plan.md)  
  Step-by-step plan to add realtime updates across devices and tabs. Each step is independent, testable, and introduces one core concept.

- PWA Plan (installability + offline) — **TBD**  
  Placeholder: `docs/pwa-plan.md` (to be added later). Will cover manifest, service worker (precache + offline page), and an optional offline data/outbox model.

---

## How to use these docs when resuming work later

1. Open the relevant plan (e.g., [Realtime Sync Plan](./realtime-sync-plan.md)).
2. Identify the **last completed step** and the **next step to implement**.
3. In your chat, paste:
   - The files you touched since the last step (only the relevant parts).
   - The sentence:  
     > “I’ve completed Step **N** from the plan and want to implement **Step N+1** next.”
   - A link or copy of the plan section if helpful.
4. Proceed with the step’s acceptance criteria and verification notes.

---

## Working notes (optional but handy)

- **Stack**: Next.js App Router, React, Supabase (SSR + Realtime), RSC + Server Actions.
- **Source of truth**: Server-side data fetches; browser realtime listeners trigger `router.refresh()` with a small debounce.
- **Security**: Keep RLS enabled; Realtime respects your policies.

---

## Change log (optional)

Use a simple running log as you complete steps:

- **2025-11-19** — Added `docs/realtime-sync-plan.md`; created this `docs/README.md`.
- **YYYY-MM-DD** — Completed Realtime Step 0 (prove refresh).  
- **YYYY-MM-DD** — Completed Realtime Step 1 (browser client).  
- …

