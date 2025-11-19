# Snack Dragon – Realtime Sync Plan (Across Devices & Tabs)

> **Audience:** You (experienced C/C++ dev, first large web app)
>
> **Goal:** Add realtime synchronization to the app in small, independent, testable steps.  
> We “grow” the feature from first principles to a best‑practice implementation you’d ship.

---

## How to use this document

- Work **step by step**. Each step introduces one core concept and produces something testable.
- This doc intentionally avoids pasting app source code. It tells you **what to change, where, and how to verify**.
- At any time you can say:  
  “Here’s my code, here’s the step I’m on, and here’s this plan. Let’s continue with the next step.”

---

## TL;DR – Milestones

| # | Focus (one core concept) | What becomes true |
|---|---|---|
| 0 | **RSC refresh** | Manual `router.refresh()` re-renders server data on demand |
| 1 | **Browser Supabase client** | Browser can read auth & make client calls |
| 2 | **Enable Realtime** | DB emits change events for your tables |
| 3 | **Listen** (broad) | Day page logs any `entries` change for your user |
| 4 | **Scope** to a **single day** | Only changes for the current day are received |
| 5 | **Refresh on event** (debounced) | Two devices/tabs on same day auto-sync |
| 6 | **No-day bootstrap** | If a Day row is created remotely, your page starts listening and updates |
| 7 | **De‑dupe** own writes | Writing tab avoids redundant extra refresh |
| 8 | **Lifecycle & resilience** | Clean teardown; reconnect after blips; tiny status indicator |
| 9 | **Roll-out** to other pages | Catalog/Goals/Weights/Charts sync in real time |
| 10 | **Multi‑tab polish** | Same‑device tabs coordinate via `BroadcastChannel` (optional) |
| 11 | **Quality bar** | Final acceptance checks & test matrix |

---

## Architecture gist (what we’re building)

- **Server remains source of truth.** Your pages already fetch on the server; we’ll keep that.
- **Realtime “bridge” lives in the browser.** It subscribes to scoped DB events and calls `router.refresh()` with a short **debounce**.
- **Tight filters.** Each page listens only to rows it cares about (e.g., Day page → `entries` for that `day_id`).
- **Polish.** De‑dupe self‑refreshes; handle “day not yet created”; clean up on unmount; recover on reconnect; optional same‑device hints.

---

## Pre-requisites (one‑time)

1. **Environment is already set** for Supabase SSR in Next (you have `SUPABASE_URL`, `SUPABASE_ANON_KEY`, middleware that keeps auth cookies fresh).
2. **Realtime publication & identity**
   - In your Supabase project, **enable Realtime** for these tables:  
     `entries`, `days`, `goals`, `weights`, `catalog_items`.
   - For delete events with usable “old row” data (so you can still filter by `day_id`), set:
     ```
     ALTER TABLE entries REPLICA IDENTITY FULL;
     ```
   - RLS stays on; Realtime respects policies just like normal queries.

3. **Terminology in this doc**
   - **Bridge** → a small **Client Component** that subscribes to events and decides when to refresh.
   - **Ignore window** → brief time after your own write settles where you skip Realtime‑triggered refresh in that tab.

---

## Files you’ll likely touch (names suggested)

- `lib/supabase/client.ts` – **browser** Supabase client helper (distinct from your existing server helper).
- `components/realtime/DayRealtimeBridge.tsx` – Day‑specific bridge (grown first).
- `components/realtime/RealtimeBridge.tsx` – Generic, parameterized bridge (introduced later; used by other pages).
- Pages where bridges are mounted:
  - `app/day/[ymd]/page.tsx` (Day), `app/catalog/page.tsx`, `app/goals/page.tsx`, `app/weights/page.tsx`, `app/charts/page.tsx`.

> You won’t write all of these at once. The steps below tell you when to add each piece.

---

## Step-by-step plan

### Step 0 — Prove the refresh path

**Concept:** In Next.js App Router, `router.refresh()` is how a client event causes **server data to re-render**.

**What to change (high level):**
- Create a tiny client-only test button on the Day page that calls `router.refresh()`.

**Acceptance / Verify:**
- Open two tabs on the same day. Add an entry in Tab A.  
  Click your test button in Tab B → the new entry appears.  
  ✅ Refresh pipeline proven.

**Rollback:** Remove the test button any time; it’s purely a local dev helper.

---

### Step 1 — Add a browser Supabase client

**Concept:** Realtime runs in the **browser**, but you already use a **server** client. Add a separate **browser** client that shares auth via cookies.

**What to change:**
- Add `lib/supabase/client.ts` exporting a browser client.  
- In a tiny client component, call `supabase.auth.getUser()` and log the user id to prove cookies flow.

**Acceptance / Verify:**
- Day page logs the user id in the browser console when you’re signed in.  
  If null, fix cookie flow before proceeding.

---

### Step 2 — Ensure Realtime is enabled (DB)

**Concept:** The DB must publish changes to clients.

**What to change:**
- In Supabase → turn on Realtime for `entries`, `days`, `goals`, `weights`, `catalog_items`.
- Run once: ```ALTER TABLE entries REPLICA IDENTITY FULL;```

**Acceptance / Verify:**
- With the Supabase console or a scratch page, make a change → see a Realtime event.

---

### Step 3 — First listener (broad, user‑scoped)

**Concept:** Subscribe to events with a simple filter to see the stream work end‑to‑end.

**What to change:**
- Add `DayRealtimeBridge` (Client Component) and mount it on the Day page.  
- Subscribe to Postgres Changes on `entries` **filtered by your `user_id`** (broad scope). For each `INSERT|UPDATE|DELETE`, log an event.

**Acceptance / Verify:**
- In two browsers/devices, edit entries in one → console logs appear in the other.

**Notes:** We’ll narrow scope in the next step. This one is for confidence only.

---

### Step 4 — Narrow the scope to the current day

**Concept:** Good realtime is **scoped** to reduce noise and work.

**What to change:**
- From the server component, pass into `DayRealtimeBridge`:
- `selectedYMD` (current literal date string).
- `dayId` (if a `days` row exists).
- If `dayId` exists, subscribe to `entries` filtered by **`day_id = <dayId>`** (plus schema/table).

**Acceptance / Verify:**
- Edits on **other days** do **not** log.  
- Edits on the **current day** do.

---

### Step 5 — Refresh on event (debounced)

**Concept:** Turn logs into UX by refreshing when an event arrives. Use a debounce so bursts collapse into a single refresh.

**What to change:**
- In `DayRealtimeBridge`, when scoped `entries` events arrive:
- Schedule `router.refresh()` with a **200–300 ms** debounce.

**Acceptance / Verify:**
- Two tabs on the same day. In Tab A, add/toggle/delete → Tab B updates within ~1s **without** manual refresh.

**Perf note:** Reorder can emit multiple updates; the debounce prevents a “refresh storm”.

---

### Step 6 — Bootstrap when there is **no Day row yet**

**Concept:** If a date has no `days` row, Tab B should still notice when Tab A creates it.

**What to change:**
- If `dayId` is **absent**, also subscribe to `days` filtered by `date = selectedYMD` **and your `user_id`**.
- On a `days INSERT`:
- Capture the new `dayId`.
- Start the `entries` subscription scoped to that `dayId`.
- Trigger one refresh (debounced).

**Acceptance / Verify:**
- Open the same empty date in two tabs.  
Add an entry in Tab A → Tab B receives the `days` insert, begins listening to `entries`, and refreshes to show the new entry.

---

### Step 7 — De‑dupe your **own** writes

**Concept:** Your forms already refresh the page when an action settles. The same tab will also get a Realtime event → potentially a redundant second refresh. We avoid that with a small **ignore window**.

**What to change:**
- After a local server action completes (you can centralize this near `RefreshOnActionComplete` or a small helper), set a **timestamp** or broadcast a short **“local-change”** signal.
- In `DayRealtimeBridge`, if an incoming event arrives within **~400 ms** of that local signal, **skip** triggering `router.refresh()` in that tab.

**Acceptance / Verify:**
- Perform rapid edits (toggle or reorder). The writing tab refreshes once per change, not twice.  
- The **other** tab/device still refreshes as usual.

**Optional later:** Use `BroadcastChannel` to share the “local-change” pulse across same‑device tabs (Step 10).

---

### Step 8 — Lifecycle & resilience

**Concept:** Subscriptions must be created, updated, and cleaned up predictably; the socket may reconnect.

**What to change:**
- Ensure the bridge **unsubscribes** on unmount and re‑subscribes if `dayId` or filters change.
- Track connection state (opened/closed/reconnected) and expose a minimal UI cue (e.g., a small dot in the Day header, or dev-only console logs).
- Let Supabase handle reconnects; if repeated failures occur, you can back off refreshes to avoid churn.

**Acceptance / Verify:**
- Navigate between days/routes → no memory leaks (watch console; no duplicate events).  
- Toggle network offline/online in DevTools → bridge reconnects; events resume.

---

### Step 9 — Roll out to other pages (generalization)

**Concept:** Extract a generic bridge so each page can subscribe with its own filter and refresh policy.

**What to change:**
- Create a `RealtimeBridge` that accepts:
- **Source**: one of `entries | days | goals | weights | catalog_items`
- **Filter spec**: e.g., `user_id = <uid>` or `day_id = <id>`
- **Event kinds**: one or more of `INSERT | UPDATE | DELETE`
- **onEvent (optional)**: custom reaction (most pages just refresh)
- Use it on:
- **Catalog** → filter by `user_id`
- **Goals** → filter by `user_id`
- **Weights** → filter by `user_id`
- **Charts** → either listen to the underlying sources, or rely on the Day/Catalog/Weights/Goals page refreshes (your choice)

**Acceptance / Verify (each page):**
- Open the page in two windows; add/edit/delete in one; the other updates within ~1s.  
- Check that unrelated pages aren’t refreshing unnecessarily.

---

### Step 10 — Same‑device multi‑tab polish (optional nicety)

**Concept:** `BroadcastChannel` lets tabs on the same device **nudge** each other immediately—before any network event arrives.

**What to change:**
- Create a `BroadcastChannel('snackdragon-rt')`.
- After a **local** change settles, broadcast a short message (e.g., `{scope:'day', ymd:'2025‑11‑19'}`).
- Tabs listening on that channel:
- If they’re on the same scope (same day or page), they can **refresh immediately** (or mark an `ignore window` to avoid double‑refresh when the Realtime event arrives shortly after).

**Acceptance / Verify:**
- Two tabs on the **same device**: edits in Tab A show in Tab B virtually instantly.

**Note:** This is purely polish. Realtime already keeps tabs/devices in sync; BroadcastChannel just reduces perceived latency for same‑device experiences and helps de‑dupe.

---

### Step 11 — Quality bar & test matrix

**Concept:** Define “done” clearly and test it.

#### Definition of Done (per page)
- **Scope**: Subscriptions are tight (only rows relevant to the page).
- **Debounce**: Bursts (e.g., reorder) produce a single refresh.
- **De‑dupe**: Own writes don’t cause double refresh.
- **Lifecycle**: No duplicate subscriptions after navigation; unsubscribes cleanly.
- **Resilience**: Reconnect works; offline doesn’t spam errors.
- **Security**: RLS is still enforced (no cross‑user bleed).
- **Perf**: CPU/network stay calm during rapid edits.

#### Manual test matrix
- Two browsers, same account:
- Day: add/toggle/update qty/delete/reorder → other browser reflects each change.
- Catalog / Goals / Weights: create/edit/delete → other browser reflects change.
- Charts: confirm when underlying data changes, the next refresh shows it (or listen directly).
- One tab offline → make changes elsewhere → go online → tab catches up.
- Navigate rapidly between days → no duplicate event handlers; no spurious updates.

---

## Page‑specific subscription specs (for quick reference)

> Use these as a checklist for your filters; exact code is up to you.

- **Day page**
- When `dayId` known:
  - **Table:** `entries`
  - **Events:** `INSERT`, `UPDATE`, `DELETE`
  - **Filter:** `day_id = <dayId>`
  - **Action:** Debounced `router.refresh()`
- When `dayId` unknown:
  - **Table:** `days`
  - **Events:** `INSERT`
  - **Filter:** `date = <selectedYMD>` AND `user_id = <current user>`
  - **Action:** Capture new `dayId`, start `entries` subscription, refresh once

- **Catalog page**
- **Table:** `catalog_items`
- **Events:** `INSERT`, `UPDATE`, `DELETE`
- **Filter:** `user_id = <current user>`
- **Action:** Debounced refresh

- **Goals page**
- **Table:** `goals`
- **Events:** `INSERT`, `UPDATE`, `DELETE`
- **Filter:** `user_id = <current user>`
- **Action:** Debounced refresh

- **Weights page**
- **Table:** `weights`
- **Events:** `INSERT`, `UPDATE`, `DELETE`
- **Filter:** `user_id = <current user>`
- **Action:** Debounced refresh

- **Charts page**
- Option A (simplest): Re-render when navigating here, relying on other pages to keep data hot.  
- Option B (full realtime): Subscribe to `entries`, `weights`, `goals` for the current user; debounced refresh.

---

## Operational notes & gotchas

- **Delete filtering:** Without `REPLICA IDENTITY FULL`, delete events won’t include old row values; you need them to route a delete to the correct day. That’s why we enabled it on `entries`.
- **Avoid global subscriptions.** Always filter (e.g., `day_id`, `user_id`) to cut noise and work.
- **Debounce windows:** Typical `200–300 ms` is enough. Use `400 ms` for the “ignore window” after local writes.
- **Unmount cleanup:** Always unsubscribe in effect cleanup to prevent duplicate listeners.
- **Network flaps:** Supabase client auto‑reconnects; just avoid spamming `router.refresh()` while disconnected.
- **Security:** Realtime respects RLS; keep your policies as they are.

---

## Resuming later (how to “remind” this plan)

When you come back:

1. Paste your current code (only the relevant files that changed since last step).
2. State the **step number** you’ve completed and the **next step** you want to implement.
3. Include this plan file (or the relevant section).
4. Ask to “continue with the next step.”

Example:
> “Here’s my current `DayRealtimeBridge` and `app/day/[ymd]/page.tsx`. I completed Step 4.  
> Let’s do **Step 5 – refresh on event (debounced)** next.”

---

## Appendix: What “best practice” looks like when you’re done

- Each page mounts a **scoped** `RealtimeBridge` with tight filters and a small debounce.
- The bridge dedupes own writes via an **ignore window** (and optionally shares pulses via `BroadcastChannel`).
- Subscriptions are cleaned up on unmount; they resubscribe if the page changes its filter (e.g., different `dayId`).
- Reconnect is automatic; the page remains calm during disconnections.
- All main pages (Day, Catalog, Goals, Weights, Charts) stay in sync across devices and tabs with minimal overhead.

---
