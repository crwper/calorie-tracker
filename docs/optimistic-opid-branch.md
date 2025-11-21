# Snack Dragon — Optimistic Day Page with Op‑ID Acks (v2 Spec)

> **Audience:** You (experienced C/C++ dev, newer to modern web)
>
> **Scope (this branch):** Day page (`/day/[ymd]`) only, focusing on `entries`.  
> **Later:** Apply the same pattern to Catalog, Goals, Weights, Charts.

This is the updated, **authoritative spec** for the “optimistic Day page with op‑id acks” work. It supersedes the earlier `optimistic-opid-branch.md` wherever there are conflicts.

The intent is that if the code or behavior gets hairy, we can come back here and answer:
> “What should the Day page *actually* be doing?”

---

## 1. High‑level goals

1. **Fully optimistic Day page**
   - For the current day (`/day/[ymd]`), **every gesture** updates the UI immediately:
     - Toggle eaten/planned
     - Change quantity
     - Reorder entries
     - Add (manual + from catalog)
     - Delete
   - The entries list and the totals row at the bottom stay in sync with each other at all times.

2. **Server/DB remains the source of truth**
   - Postgres (accessed via Supabase on the server) is the **canonical** state.
   - The Day page in each tab keeps a **replica** of that state in memory:
     - Initially loaded from the server render.
     - Modified optimistically for local gestures.
     - Reconciled as realtime change events arrive.

3. **Per‑gesture op‑ids + acks**
   - Each user gesture is tagged with a **client‑generated `op_id`** (UUID).
   - The corresponding server operation (RPC) **stamps that `op_id` into the affected row(s)** via a `client_op_id` column.
   - Realtime notifications include this `client_op_id`, allowing us to:
     - Track operations in progress.
     - Know which events are **our own acks** vs **remote changes**.

4. **Saving indicators tied to real acks**
   - Each entry has a conceptual **set of pending op‑ids** that mention it.
   - The “Saving…” indicator is **on** while this set is non‑empty.
   - Only after *all* ops for that entry have acked (and optionally a short “sticky” delay) does “Saving…” turn off.
   - If **no** entries (and no deletes) are “saving”, it is safe to assume that, from this tab’s point of view, all of its writes have been persisted and acknowledged by the server.

5. **Realtime is used as a data feed, not just a refresh trigger**
   - Realtime events are treated as **patches from the canonical server state**:
     - For our own ops, they confirm and finalize what we *thought* would happen.
     - For remote ops (other tabs/devices), they update our local replica.
   - For the Day writer tab, we **prefer to trust and apply the event patch** instead of falling back to a full page refresh.
   - A debounced `router.refresh()` remains available as a **fallback** for unknown or suspicious cases (e.g., missing acks, timeouts).

---

## 2. Core invariants

These are rules the system should obey once the branch is complete.

1. **Entries and totals are always self‑consistent in this tab**
   - At any instant, the Day page’s entries array and the totals row are derived from the **same local replica**.
   - Optimistic updates and realtime patches both flow through this replica.
   - There is no state where a row shows 300 kcal but totals reflect some stale value.

2. **Server wins when there is disagreement (once ops are resolved)**
   - The Day tab may **run ahead** of the server using optimistic updates.
   - Once a realtime event arrives for a row (or a full refresh completes), we treat the server’s data as authoritative.
   - If the server’s version differs from our optimistic guess, we update our local replica to match.

3. **Op‑id semantics**
   - Every Day‑page gesture that writes `entries` has a fresh `op_id`.
   - The server stamps that `op_id` into the mutated `entries` row(s) via a `client_op_id` column.
   - Realtime `INSERT` / `UPDATE` / `DELETE` events for `entries` always carry the last `client_op_id` that touched that row:
     - For `INSERT` / `UPDATE`: `new.client_op_id`.
     - For `DELETE`: `old.client_op_id` (requires `REPLICA IDENTITY FULL`, already enabled).

4. **Saving lights = pending ops**
   - For an entry `E`, let `pendingOps(E)` be the set of op‑ids that declared they affect `E` and have not yet acked.
   - `E` is marked as “Saving…” if and only if `pendingOps(E)` is non‑empty.
   - A delete is treated as affecting the row until the DELETE ack arrives (even though the row is visually gone; see error handling below).

5. **Local vs remote changes (writer tab)**
   - If a Realtime event’s `client_op_id` **is in our pending op registry**:
     - This is an **ack** for one of our ops.
     - We:
       - Apply the event patch to our local replica.
       - Remove that `op_id` from the registry and from any affected entries.
       - Clear “Saving…” where appropriate.
     - We **do not** `router.refresh()` for this ack.
   - If the event’s `client_op_id` **is not in our registry**:
     - This is treated as a **remote change** (another tab/device, or very old op).
     - We **still apply the patch** to our local replica, so we see the new row contents.
     - We may optionally trigger a **debounced `router.refresh()`** if we suspect there are related rows or derived data we didn’t patch (for `entries` alone, the patch is usually sufficient).

6. **When Saving indicators are all off**
   - The op registry is empty.
   - Every operation initiated in this tab has either:
     - Been fully acknowledged via Realtime (and the replica patched accordingly), or
     - Failed in a way where we’ve already reconciled with the server (full refresh, error UI, or explicit rollback).

---

## 3. Data model & new fields

### 3.1 DB changes (entries table)

We introduce a new column on `public.entries`:

- `client_op_id uuid NULL`
  - Last client operation id that mutated this row.
  - Set by server functions (`add_entry_with_order`, `update_entry_qty_and_status`, `reorder_entries`, `delete_entry_with_op`, etc.).
  - Not directly editable from arbitrary client code; always set by controlled RPCs.

We continue to rely on:

- `REPLICA IDENTITY FULL` on `entries` so delete events include `old.*`, including `client_op_id`, `day_id`, etc.

### 3.2 Client‑side model

On the Day page, the writing tab maintains:

1. **Entries replica**
   - An in‑memory array `entries[]`, each element roughly:
     ```ts
     type EntryView = {
       id: string;             // may be real DB id or a client-temp id for new rows
       isTemp: boolean;        // true for pre-INSERT rows
       name: string;
       qty: number;            // numeric, not string
       unit: string;
       kcal: number;           // kcal_snapshot-like, as seen by the user
       status: 'planned' | 'eaten';
       createdAt: string;      // best-effort; may be client timestamp for temps
       savingOpIds: Set<string>;  // op-ids currently touching this entry
     }
     ```

   - Derived totals (`totalPlanned`, `totalEaten`, `totalAll`) are computed as pure functions of this replica on every render.

2. **Pending ops registry**
   - A map indexed by `op_id`:
     ```ts
     type PendingOpKind =
       | 'toggle_status'
       | 'change_qty'
       | 'add_manual'
       | 'add_from_catalog'
       | 'delete'
       | 'reorder';

     type PendingOp = {
       id: string;                 // op_id
       kind: PendingOpKind;
       entryIds: string[];         // entry ids this op claims to affect (local ids)
       startedAt: number;          // ms since epoch, for timeout/error handling
       // optional extras: original payload for debugging
     };

     type PendingOpRegistry = Map<string, PendingOp>;
     ```

   - This registry does **not** know about actual DB ids or day ids; it uses the same ids the Day replica uses.
   - For new entries where the DB assigns the final id, we treat the local `id` as a **temp id** and swap it on ack (see below).

3. **Timeout/error mechanism (later step)**
   - A long timeout (e.g. 10–20 seconds) per op.
   - If an op has no ack after the timeout, we:
     - Consider it “stuck”,
     - Show a small error UI,
     - Trigger a one‑off `router.refresh()` to resync with the server,
     - Rebuild the replica + pending registry based on the fresh data.

---

## 4. Gesture flows (canonical behavior)

Each Day gesture follows a similar pattern.

### 4.1 Add (manual or from catalog)

**Intent:** user adds a new entry to the current day.

1. **User gesture**
   - Manual add: user submits a form with name/qty/unit/kcal/status.
   - Catalog add: user clicks a chip; we know the catalog item and default qty.

2. **Client generates `op_id` and temp row**
   - Generate `op_id = crypto.randomUUID()`.
   - Generate `tempId = "temp:" + crypto.randomUUID()` for the new entry.
   - Create an `EntryView` row with `id = tempId`, `isTemp = true`, fields derived from the gesture, and `savingOpIds = {op_id}`.
   - Append this row to `entries` and recompute totals immediately.

3. **Client sends server command**
   - Call a server action that ultimately invokes an RPC like:
     ```sql
     add_entry_with_order(
       p_day_id, p_name, p_qty, p_unit, p_kcal, p_status,
       p_catalog_item_id := ...,      -- for catalog adds
       p_client_op_id    := op_id
     )
     ```
   - The RPC:
     - Validates day ownership (`auth.uid()`),
     - Appends the entry at the correct ordering,
     - Stores `client_op_id = op_id`,
     - Returns the real row id (if needed for the server action).

4. **Realtime ack (INSERT)**
   - Realtime emits an `INSERT` on `entries` with `new.id`, `new.day_id`, `new.client_op_id = op_id`, etc.
   - In the Day writer tab, we:
     - Recognize `op_id` in the pending registry → this is an **ack**.
     - Patch the replica:
       - Find the temp row whose `id === tempId` (we remember this mapping in the pending op).
       - Replace `id` with `new.id` and `isTemp = false`.
       - Overwrite fields (qty, kcal, status, etc.) from `new.*` to align with server.
     - Update `savingOpIds`:
       - Remove `op_id` from that row’s set.
       - If the set becomes empty, “Saving…” can eventually turn off (after sticky delay).
     - Remove the op from the registry.

5. **Remote tabs/devices**
   - For tabs that didn’t initiate this op, there is no pending registry entry.
   - When they see the `INSERT` event:
     - `client_op_id` is unknown, but we still trust the event patch:
       - Add the new row to their entries replica at the right spot and update totals, *or*
       - (simpler, but heavier) debounce a `router.refresh()` to pull the entire Day snapshot from the server.

### 4.2 Toggle eaten/planned

**Intent:** user flips the checkbox for one entry.

1. **User gesture**
   - Click checkbox; toggles between `planned` and `eaten`.

2. **Client generates `op_id` and optimistic update**
   - `op_id = crypto.randomUUID()`.
   - Optimistically update the entry in the replica:
     - Flip `status`.
     - If necessary, also update any related fields (we’ll rely on the RPC to keep kcal consistent; see qty + status combo below).
   - Add `op_id` to that entry’s `savingOpIds` set.

3. **Client sends server command**
   - If we keep status+qty joint, this might call `update_entry_qty_and_status` with the existing qty and the new status, plus `p_client_op_id = op_id`.
   - The RPC computes per‑unit kcal and updates `kcal_snapshot`, `status`, `client_op_id` in one transaction.

4. **Realtime ack (UPDATE)**
   - On an `UPDATE` event with `new.client_op_id = op_id`:
     - Treat as ack.
     - Patch the entry’s fields from `new.*` (including status and kcal).
     - Remove `op_id` from its `savingOpIds`.
     - Remove op from registry.

### 4.3 Change quantity (auto‑save)

**Intent:** user edits the quantity input for an entry.

1. **User gesture**
   - User types into the qty field; we use a **debounced** auto‑save (e.g. 600ms).

2. **Client generates `op_id` per committed change**
   - For each debounced commit (when we decide “this is a real change we’re sending”), we:
     - Generate a new `op_id`,
     - Update the replica’s qty and derived kcal immediately,
     - Add `op_id` to this entry’s `savingOpIds`,
     - Append a `PendingOp` with `kind='change_qty'` and the entry’s id.

3. **Client sends server command**
   - Call an RPC like `update_entry_qty_and_status(p_entry_id, p_qty, p_next_status, p_client_op_id)`.
   - The RPC:
     - Validates ownership via `days.user_id`,
     - Computes per‑unit kcal,
     - Stores the snapshot and `client_op_id = op_id`.

4. **Realtime acks (UPDATE, possibly out of order)**
   - Several qty ops might be in flight for the same entry.
   - For each `UPDATE` with `new.client_op_id = op_id`:
     - Patch the entry’s fields from `new.*`,
     - Remove that `op_id` from `savingOpIds`,
     - Remove the op from the registry.
   - The entry’s “Saving…” indicator remains on until **all** its qty ops have acked (the set is empty).

### 4.4 Delete

**Intent:** user deletes an entry.

1. **User gesture**
   - Click the delete button on a row.

2. **Client generates `op_id` and optimistic removal**
   - `op_id = crypto.randomUUID()`.
   - Remove the entry from the replica immediately (so it disappears from the list and totals update).
   - Add a `PendingOp` with `kind='delete'` and that entry’s id.

3. **Client sends server command**
   - Call a dedicated RPC `delete_entry_with_op(p_entry_id, p_client_op_id)` that:
     - Validates ownership,
     - In a single transaction:
       - `UPDATE entries SET client_op_id = p_client_op_id WHERE id = p_entry_id`,
       - `DELETE FROM entries WHERE id = p_entry_id`.

4. **Realtime ack (DELETE)**
   - Realtime emits a `DELETE` with `old.client_op_id = op_id`.
   - In the writer tab:
     - We see the matching `op_id` in the registry → ack.
     - Since we already removed the entry optimistically, we don’t need to adjust the replica further.
     - We clear the pending op and any global “saving” signal that relates to deletes.

5. **Remote tabs/devices**
   - They receive the `DELETE` event with `old.id`, `old.day_id`, etc.
   - They remove that row from their replica and update totals, or debounce a full refresh.

### 4.5 Reorder

**Intent:** user drags items to reorder the Day list.

1. **User gesture**
   - Drag‑and‑drop reorder in `EntriesList`.

2. **Client generates one `op_id` for the gesture + optimistic reorder**
   - `op_id = crypto.randomUUID()`.
   - Reorder the local `entries` array using `arrayMove`.
   - For each moved entry, add `op_id` to its `savingOpIds`.
   - Add a `PendingOp` with `kind='reorder'` and `entryIds = [...]`.

3. **Client sends server command**
   - Call RPC `reorder_entries(p_day_id, p_ids, p_client_op_id)`:
     - Validates `day_id` and ownership,
     - Temporarily marks orderings to avoid unique collisions,
     - Assigns new orderings in 0..N‑1 order,
     - Sets `client_op_id = p_client_op_id` on each touched row.

4. **Realtime acks (UPDATE for multiple rows)**
   - Each updated row emits an `UPDATE` with `new.client_op_id = op_id`.
   - The writer tab:
     - Patches the entries’ positions and fields from `new.*` (even though we already reordered locally, we align to the server’s ordering and any other changes).
     - For each affected entry, removes `op_id` from `savingOpIds` when its ack arrives.
     - When the last of those rows has acked, “Saving…” for the whole reorder gesture is effectively done.
   - We don’t need to count updates; the per‑entry pending set is enough.

---

## 5. Realtime behavior for the Day writer tab

We treat Realtime as the stream of **canonical patches** from the server and classify events using `client_op_id`.

### 5.1 Event classification

For each `entries` event on the current day:

1. Extract `op_id` from the payload:
   - `op_id = new.client_op_id` for INSERT/UPDATE,
   - `op_id = old.client_op_id` for DELETE.

2. Look up `op_id` in the local `PendingOpRegistry`.

3. If `op_id` **exists** → this is an **ack** for a local op.
   - Patch the replica with `new` or remove the row on `DELETE`.
   - Update `savingOpIds` sets for affected entries.
   - Remove the op from the registry.
   - Do **not** call `router.refresh()`.

4. If `op_id` **does not exist** → this is a **remote change**.
   - Still patch the replica using the event’s data (insert/update/delete the row).
   - For now, we do **not** fire an automatic refresh on every remote patch; the event itself keeps us in sync.
   - A debounced `router.refresh()` remains available as a safety valve if we detect that our replica might not have enough context to patch correctly (e.g., major schema changes, complex multi‑table operations).

### 5.2 Other event sources

For **non‑entries** events relevant to the Day page (e.g., `goals` affecting the “Goal: X kcal” label), we can keep the existing simpler behavior for now:

- Treat them as reasons to `router.refresh()` the Day page and re‑derive the active goal.

Later, we can extend the op‑id / patch model to those tables as well.

---

## 6. Error handling & timeouts

Optimistic UI implies we must decide what to do if something goes wrong.

### 6.1 Immediate server action errors

- If a server action (RPC wrapper) returns an error synchronously, we:
  - Do **not** create an op entry in the registry, or we clear it immediately.
  - Revert the optimistic change if possible (e.g., restore the old qty / status / row).
  - Show a small inline Alert near the affected UI (“Couldn’t save change. Please try again.”).
  - Optionally log the error in the console in dev.

Because no row was actually written, **no Realtime event** will arrive for this op‑id.

### 6.2 Missing acks (RT hiccups, sleeping tabs)

If the RPC succeeds but Realtime is slow or disconnected, we may have pending ops that never see a matching ack.

Policy:

1. When we register a pending op, we set `startedAt = Date.now()`.
2. Periodically (or via a `setTimeout` per op), we check `now - startedAt` against a threshold (e.g., 10–20s).
3. If an op exceeds the threshold and is still pending:
   - Show a small top‑level warning (e.g., “Having trouble staying in sync. Refreshing…”).
   - Trigger a one‑off `router.refresh()` to fetch the Day snapshot from the server.
   - After refresh:
     - Rebuild the entries replica from server data.
     - Clear all pending ops and saving flags (the user may need to repeat an action if it truly failed).
     - Optionally show a toast like “Some changes might not have saved; the page has been reloaded.”

This keeps the system from getting “stuck” with permanent “Saving…” indicators.

### 6.3 Deletes and hidden “Saving” indicators

For deletes, the row disappears from the list immediately, so there is no per‑row UI to show “Saving…”. We have two options:

- **Simple approach** (initial):
  - Use a small **global** saving indicator somewhere on the Day page (e.g. “Saving changes…” at the top/bottom) while any delete op is pending.
  - When the delete’s `DELETE` ack arrives or the fallback refresh completes, clear it.

- **Advanced approach** (later):
  - Implement an “undo” affordance that stores recently deleted rows and can restore them if the server action fails.

For the initial spec, the **simple global indicator** is sufficient.

---

## 7. Interaction with server renders and other pages

### 7.1 Day server render

- The server still renders the Day page with a snapshot of:
  - Entries for the selected day,
  - The active goal row,
  - Initial totals (derived on the server for hydration, but the client will take over).
- The Day client wrapper (new component) receives this snapshot as props and:
  - Initializes its replica and totals from it,
  - Then becomes responsible for all subsequent updates via optimism + Realtime patches.

### 7.2 Other pages (Catalog / Goals / Weights / Charts)

In this branch:

- Catalog, Goals, Weights, Charts **keep their existing behavior**:
  - Forms with `RefreshOnActionComplete`,
  - `RealtimeBridge` using a TTL‑based `ignoreLocalWrites` window,
  - Debounced `router.refresh()` on events.

Later, we can progressively move them to the **op‑id + patch model**, but Day is the proof‑of‑concept and will be the most complex case.

---

## 8. Implementation outline (for future-you)

This is not strict, but gives a natural order of attack. You can stop after any step with a working app.

1. **DB & schema prep**
   - Add `client_op_id uuid` to `entries`.
   - Extend RPCs to accept an optional `p_client_op_id` and write it:
     - `add_entry_with_order`
     - `update_entry_qty_and_status`
     - `reorder_entries`
   - Add a new RPC `delete_entry_with_op(p_entry_id, p_client_op_id)` (update‑then‑delete).

2. **Day client wrapper + replica**
   - Introduce a Day client component that:
     - Accepts the server snapshot of entries + goal,
     - Owns `entries[]` replica and derived totals,
     - Renders `CatalogChipPicker`, `EntriesList`, and the totals row,
     - For now, still calls the existing server actions *without* op‑ids.

3. **Pending op registry + “Saving…” plumbing**
   - Implement a small in‑memory op registry (singleton or hook).
   - Wire per‑entry `saving` flags in the UI to `savingOpIds.size > 0` instead of only `useFormStatus`.
   - Keep using router.refresh on settle as before; the goal is to prove out the saving logic.

4. **Op‑id plumbing into server actions + RPCs**
   - Generate `op_id` per gesture in the client wrapper.
   - Pass `op_id` into the relevant server actions and then into the RPCs.
   - Register pending ops with the registry, and update entries’ `savingOpIds` at gesture time.

5. **Realtime acks + patching (Day writer tab)**
   - Adjust the Day‑specific realtime subscription to:
     - Extract `client_op_id` from events,
     - Classify events as ack vs remote,
     - Patch the entries replica according to event type,
     - Clear pending ops and `savingOpIds` on acks,
     - Avoid `router.refresh()` for known op‑ids.

6. **Disable form‑settle refreshes on Day**
   - Remove `RefreshOnActionComplete` from Day‑page forms and DnD operations.
   - Rely entirely on optimistic updates + Realtime patches in the writer tab.
   - Keep Realtime + `router.refresh()` behavior for **other pages** as‑is.

7. **Error handling and timeouts**
   - Add timeout logic for pending ops with no acks.
   - Implement a one‑off full refresh and error UI as discussed above.

8. **Polish & extension**
   - Refine the “Saving…” UI (per‑row + optional global indicator).
   - Once solid on Day, consider extracting generic op‑tracking & patch logic so other pages can opt into the same pattern.

---

## 9. How to use this spec when resuming work later

When you come back to this branch:

1. Skim this spec to re‑load the mental model (server as source, Day replica, op‑ids, acks).
2. Open the code and note which of the steps in Section 8 are already completed.
3. In your chat, say something like:
   > “I’m implementing the op‑id Day page spec (v2). I’ve finished step N and want to tackle step N+1 next. Here’s the relevant code.”
4. Use the invariants in Section 2 to sanity‑check behavior as you go (especially the saving lights and the local vs remote event distinction).

If behavior diverges from this spec and you’re unsure whether the code or the spec is wrong, treat **this spec as the tie‑breaker** and adjust the implementation to match it unless you intentionally decide to change the spec again.
