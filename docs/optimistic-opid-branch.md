# Snack Dragon — Optimistic‑Only Day Page with Op‑ID Acks (Branch Plan)

> **Audience:** You (experienced C/C++ dev, newer to modern web)
>
> **Goal:** Make the **Day** page fully **optimistic** for *all* gestures and use a **per‑gesture op‑id** (a.k.a. correlation id) to deterministically acknowledge changes via Realtime. The **writing tab** does **not** refresh on form settle and (for this first pass) also **does not** refresh on ack; it simply clears “Saving…”. Other tabs keep refreshing normally via Realtime.
>
> **Why:** Immediate UX everywhere, zero “double refresh” races, and a clear path to more advanced reliability later (bulk operations, retries, offline/outbox).

---

## TL;DR — What we’ll build in this branch

- **Optimistic‑only policy on the Day page:** Every gesture (toggle, qty, reorder, add, delete) updates the UI **immediately** and shows a small **“Saving…”** affordance on affected items.
- **Per‑gesture op‑id (Option 2):** Each user gesture gets a client‑generated `op_id` that is **stamped into the row(s)** the server mutates (for deletes: **update‑then‑delete** in one transaction so the DELETE event carries the id in `old.*`). The writing tab keeps a small **pendingOps** registry.
- **Ack via Realtime (no TTLs):** When a Realtime event arrives with a matching `op_id`, the writing tab treats that as an **acknowledgement** and **clears “Saving…”** for the gesture. (For this first pass, the writing tab **does not** run `router.refresh()` on ack; we will monitor for gaps and improve the optimistic layer as needed.)
- **Other tabs/devices:** Continue to refresh once per change via Realtime (as you already have).

**Scope:** Day page only (`entries`).  
**Non‑goals:** Charts/Catalog/Goals/Weights (can adopt later), offline/outbox.

---

## Success criteria

- **Single tab (writer):** Every gesture updates immediately; a short “Saving…” is visible; **no full‑page refresh** is triggered in the writing tab; “Saving…” clears on ack.
- **Two tabs:** The non‑writing tab refreshes exactly once per gesture via Realtime.
- **Rapid gestures:** Multiple quick edits remain smooth. Each has its own `op_id` and clears independently.
- **Deletes:** Work deterministically with **update‑then‑delete**; the DELETE RT event carries the `op_id` in `old.*` (requires `REPLICA IDENTITY FULL` — already set for `entries`).

---

## Core concepts (no code yet)

- **`op_id` (correlation id):** A UUID generated per user gesture. Sent with the RPC and **stamped** into affected row(s) as `client_op_id` (name is up to you).
- **`pendingOps` (writer tab only):** A small map `{ op_id → { kind, startedAt, affectedIds? } }` the UI uses to show “Saving…” and to reconcile the ack.
- **Ack (Realtime):** When an RT event arrives: use `new.client_op_id` for INSERT/UPDATE and `old.client_op_id` for DELETE to find a pending op and mark it **acknowledged**.
- **Optimistic‑only policy (writer):** No `router.refresh()` in the writing tab for this branch. Other tabs refresh as they do today via RT. We’ll monitor for any gaps in optimistic math and fix those in the optimistic layer.

---

## Top‑down, incremental tutorial (each step adds one idea and is testable)

> The sequence intentionally starts with **policy** and **UX** changes, then introduces **correlation**, and finally extends it to all gestures. You can stop after any step with a working app.

### Step 0 — Baseline instrumentation (no behavior change)
**Concept:** Freeze a baseline so you can tell what changed.  
**Change:** Keep your “Rendered at …” timestamp and lightweight console markers (e.g., when a form starts/settles, when an RT event arrives).  
**Verify:** Perform a toggle/add/delete; observe today’s behavior so you have before/after comparisons.

---

### Step 1 — Adopt **optimistic‑only** in the writer tab for **toggle** (policy flip)
**Concept:** The writing tab should not rely on a full‑page refresh; it shows the user’s intent immediately and clears on ack.  
**Change:** For the **toggle** action only, stop calling `router.refresh()` in the writer tab on form settle. Keep the current optimistic flip and “Saving…” chip.  
**Verify:** Toggle in one tab → UI flips instantly and shows “Saving…”, **no full‑page refresh** in that tab; the second tab still refreshes once via Realtime; “Saving…” clears when the RT event arrives.

---

### Step 2 — Introduce **op‑id** + local **pendingOps** (toggle only)
**Concept:** Deterministic ack without time windows.  
**Change:** Generate an `op_id` when the toggle starts; store it in `pendingOps` (writer). Send it with the toggle RPC; stamp it into the row as `client_op_id`. On RT UPDATE with a matching `client_op_id`, clear “Saving…” and remove the op from `pendingOps`. Still **do not refresh** in the writer.  
**Verify:** Toggle repeatedly and quickly. Each row shows “Saving…” then clears as its own ack arrives. No full refresh in the writing tab; remote tab still refreshes via RT.

---

### Step 3 — Extend op‑id correlation to **qty changes** (auto‑save)
**Concept:** Same pattern as toggle, different field.  
**Change:** Apply the Step‑2 pattern to qty edits (optimistic recalculation + `op_id` + row stamp + RT ack clears).  
**Verify:** Change qty, see immediate kcal/total updates and “Saving…”, then ack clearing; no full refresh in writer; remote tab refreshes once.

---

### Step 4 — **Add** (simplified optimistic insert with a temp row)
**Concept:** Represent new items immediately.  
**Change:** On “Add”, create a **temporary row** locally (e.g., `id="temp:<uuid>"`) with name/qty/unit and computed kcal; show “Saving…”. Generate `op_id`, send with the insert RPC, stamp `client_op_id` on the inserted row. On RT INSERT with matching `op_id`, **swap** the temp row to the real row, clear “Saving…”. No full refresh in the writer.  
**Verify:** Add an item. It appears instantly (temp), then “locks in” when the RT event arrives. Remote tab refreshes once.

*(Note: if “add from catalog” currently does two writes, keep it simple for now—just stamp the same `op_id` on both; we’ll refine later.)*

---

### Step 5 — **Delete** (update‑then‑delete) with optimistic removal
**Concept:** Deterministic ack for deletes without extra tables.  
**Change:** On delete, remove the row from the UI immediately (or briefly fade it). Generate `op_id`; in one server transaction, first **UPDATE** the row’s `client_op_id = :op_id`, then **DELETE** it. The RT **DELETE** carries `old.client_op_id`. On matching ack, clear any global “Saving…” hint. No refresh in the writer.  
**Verify:** Delete an item. It disappears immediately; the remote tab refreshes once. No regressions if you delete several items quickly.

---

### Step 6 — **Reorder** (multi‑row) with one op‑id
**Concept:** One gesture → many rows → one deterministic ack.  
**Change:** Optimistically move items. Generate one `op_id` for the gesture; in the reorder RPC, stamp that `op_id` onto **all** touched rows while rewriting `ordering`. Treat the **first** arriving RT UPDATE with that `op_id` as the ack (clear “Saving…” across the moved rows).  
**Verify:** Drag several items. Writer shows “Saving…” then clears on first ack. Remote tab: one refresh (debounced bridge should already handle this).

---

### Step 7 — **Refine “Add from catalog”** (reduce double events)
**Concept:** Avoid extra Realtime events for a single gesture.  
**Change:** If “add from catalog” currently INSERTs then UPDATEs to set `catalog_item_id`, consider merging into a **single RPC** that sets everything on INSERT. If you keep it split, ensure both writes carry the same `op_id` and ack on the **first** INSERT.  
**Verify:** Add from catalog; writer remains optimistic‑only; remote tab shows a single refresh; verify no stray “Saving…” remains.

---

### Step 8 — **Fallback/health** policy (optional for this branch)
**Concept:** Don’t get stuck if RT is briefly unavailable.  
**Change:** Track a **long** timeout (seconds). If an op hasn’t acked, either do one full refresh or surface a small “Still saving…” banner. This is rare and outside the normal path.  
**Verify:** Temporarily block RT (e.g., disconnect), perform an action, observe fallback behavior.

---

### Step 9 — **Observability polish** (dev‑only)
**Concept:** Measure, don’t guess.  
**Change:** Add dev‑only counters/logs: time‑to‑ack per op, outstanding `pendingOps` count, total acks per minute.  
**Verify:** Exercise the UI; confirm metrics trend as expected.

---

### Step 10 — **Cleanup & readiness**
**Concept:** Lock in the policy.  
**Change:** Remove any leftover form‑settle refreshes on Day actions; ensure all Day mutations carry an `op_id`; keep the optimistic‑only writer policy. Document the behavior in code comments.  
**Verify:** Full manual test matrix (single/multi tab, rapid edits, add/delete/reorder).

---

## Risks & how we’ll handle them

- **Totals/derived data mismatches:** Treat as **optimistic layer bugs**. Fix the local math instead of falling back to refreshes. This branch intentionally keeps the writer tab refresh‑free to surface such issues early.
- **Two RT events per “add from catalog”:** Either combine into a single RPC or use one `op_id` for both and ack on the first.
- **Delete has no per‑row “Saving…” chip:** That’s fine: the row is gone. Optionally show a tiny global “Saving…” hint or a brief “Undo” affordance.
- **Multi‑row acks:** For reorder, ack on the **first** matching event; you don’t need to count them all in this branch.

---

## Test matrix (quick checklist)

- **Toggle, Qty, Add, Delete, Reorder** – single tab: immediate optimistic result, “Saving…” appears and clears on ack, **no full refresh** in writer.  
- **Two tabs:** one RT refresh in the remote tab per gesture.  
- **Rapid sequences:** several toggles/qty edits/reorders in quick succession behave independently.  
- **Edge:** repeated toggles on the same row; add then delete before ack; delete then undo (if implemented).  
- **Fallback (optional):** simulate RT hiccup and verify your safety behavior.

---

## Future follow‑ups (outside this branch)

- Extend Option 2 to Catalog/Weights/Goals, or adopt an **Outbox/Command log** table for uniform acks across multi‑table work.
- Consider a **writer‑tab refresh‑on‑ack** policy later *if* you find optimistic math gaps; for now we treat gaps as bugs in the optimistic layer.
- Add idempotency constraints if you move toward offline/outbox.
