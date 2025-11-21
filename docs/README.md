# Snack Dragon – Engineering Notebook (`docs/`)

This folder collects lightweight, living docs for platform features and implementation plans.

## Table of Contents

- [Realtime Sync Plan (Across Devices & Tabs)](./realtime-sync-plan.md)  
  Step-by-step plan to add realtime updates across devices and tabs. Each step is independent, testable, and introduces one core concept.

- [Optimistic‑Only Day Page with Op‑ID Acks (Branch Plan)](./optimistic-opid-branch.md)  
  Tutorial-style plan to make the Day page fully optimistic for all gestures and to acknowledge changes deterministically via per‑gesture op‑ids (including update‑then‑delete for deletes). Designed to be implemented top‑down in small, verifiable increments.

- PWA Plan (installability + offline) — **TBD**  
  Placeholder: `docs/pwa-plan.md` (to be added later). Will cover manifest, service worker (precache + offline page), and an optional offline data/outbox model.

---

## How to use these docs when resuming work later

1. Open the relevant plan (e.g., **Optimistic‑Only Day Page with Op‑ID Acks** for the current branch).
2. Identify the **last completed step** and the **next step to implement**.
3. In your chat, paste:
   - The files you touched since the last step (only the relevant parts).
   - The sentence:  
     > “I’ve completed Step **N** from the plan and want to implement **Step N+1** next.”
   - A link or copy of the plan section if helpful.
4. Proceed with the step’s acceptance criteria and verification notes.

---

## Working notes (quick references)

- **Stack:** Next.js App Router, React, Supabase (SSR + Realtime), RSC + Server Actions.
- **Source of truth:** Server-side data fetches; browser realtime listeners trigger updates as described in each plan.
- **Security:** Keep RLS enabled; Realtime respects your policies.

---

## Change log (optional)

- **2025-11-20** — Added `docs/optimistic-opid-branch.md`; updated this README.
- **2025-11-19** — Added `docs/realtime-sync-plan.md`; created this `docs/README.md`.
