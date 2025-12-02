# Snack Dragon Day Page – Fully Optimistic Design Notes

This document summarizes the high-level reasoning about why the `/day/[ymd]` page is still doing full refreshes, and what the target “fully optimistic from the start” architecture looks like.

No code changes are proposed here; this is purely conceptual / architectural.

---

## 1. Why full refreshes still happen

The day page (`/day/[ymd]`) now has a **client-first** feel in many ways:

- Entries are driven by a client component (`EntriesList`), which holds its own local list of entries.
- Adding, deleting, changing qty, and changing status each have **optimistic UI paths**:
  - Local list is updated immediately.
  - A server action runs in the background to persist the change.
  - A `client_op_id` is stamped so Realtime can recognize the echo.

However, the page *started life* as **server-first**, and some of that behavior remains. That’s what causes the “full refresh a second or two later” feeling.

### 1.1. What currently happens for each action

The four day-page mutations are:

- Add entry (via catalog chip)
- Change quantity (auto-save input)
- Change status (planned ⇄ eaten checkbox)
- Delete entry (trash button)

All four are optimistic, but they also trigger server-first refresh mechanisms.

#### 1.1.1. Add from catalog

Client side:

- `CatalogChipPicker` → `CatalogChipForm`
- On submit:
  - Generates `opId` and `entryId`.
  - Writes them into hidden `client_op_id` and `entry_id` inputs.
  - Builds an optimistic `DayEntry` with kcal computed locally, then calls `emitEntryAdded`.
    - `EntriesList` subscribes and appends the new entry immediately.
  - Registers a pending op in the `opRegistry`:

    ```ts
    { id: opId, kind: 'add_from_catalog', entryIds: [entryId] }
    ```

Server side (`addEntryFromCatalogAction`):

- Validates the request.
- Ensures the `day` row exists via `get_or_create_day`.
- Loads the catalog item.
- Calls `add_entry_with_order` with:
  - `p_client_op_id = opId`
  - `p_id = entryId` (so DB id matches the optimistic id).
- **Then calls**:

  ```ts
  revalidatePath(`/day/${dayDate}`);
  ```

Realtime side:

- `add_entry_with_order` inserts into `entries` and sets `client_op_id`.
- Supabase Realtime emits an `INSERT` event for `entries`.
- `RealtimeBridge` on the day page is subscribed to `entries` with a `day_id` filter.
- In `handleChange`:
  - It grabs `client_op_id` from `new`/`old`.
  - If `clientOpId` matches a pending op (`hasPendingOp`), it:
    - Calls `ackOp(clientOpId)`.
    - Marks the event as `ignore = true`.
    - **Does not** call `router.refresh()`.
  - Otherwise, it falls back to the TTL-based `shouldIgnoreRealtime` and, if not ignored, schedules a `router.refresh()`.

So for **add**, if the op-id path is working correctly, *Realtime itself* should not be refreshing the page for this local op. The main refresh is coming from `revalidatePath` in the server action.

#### 1.1.2. Change quantity

Client side:

- `AutoSaveQtyForm` is a controlled input with debounced submission.
- On valid changes:
  - Calls `onQtyOptimistic(nextQty)` → `EntriesList.applyQtyOptimistic`:
    - Updates `qty` and re-computes `kcal_snapshot` (using `kcal_per_unit_snapshot` if available).
    - Freezes `kcal_per_unit_snapshot` in local state for future edits.
  - Schedules a debounced `form.requestSubmit()`, and:
    - Generates a fresh `client_op_id`.
    - Registers pending op `{ id: opId, kind: 'update_qty', entryIds: [entryId] }`.
    - Stamps `client_op_id` hidden input.

Server side (`updateEntryQtyAction`):

- Validates qty.
- Loads the entry (may compute `perUnit` from `kcal_snapshot/qty` if needed).
- Updates `entries` with:
  - `qty`, `kcal_snapshot`, `kcal_per_unit_snapshot`, and `client_op_id = opId`.
- **Calls** `revalidatePath(`/day/${dayDate}`)`.

Realtime side:

- An `UPDATE` event comes in with `client_op_id`.
- `RealtimeBridge` sees the matching op id, `ackOp`’s it, and **ignores** the event (no `router.refresh()`).
- The visual refresh you see is again largely from `revalidatePath`.

#### 1.1.3. Change status (planned ⇄ eaten)

Client side:

- `CheckboxStatusForm`:
  - On change of checkbox:
    - Cancels any pending qty debounce (so qty and status are committed together).
    - Chooses `next_status = 'eaten' | 'planned'` and writes it into a hidden field.
    - Reads latest qty from the qty editor via `getLatestQty()` and writes it into hidden `qty`.
    - Generates `client_op_id`, registers pending op `{ id: opId, kind: 'update_qty_and_status', entryIds: [entryId] }`, and stamps it into the form.
    - Calls `form.requestSubmit()`.
    - Immediately calls `onSubmitOptimistic(nextStatus)`, which updates the entry status in local state.

Server side (`updateEntryQtyAndStatusAction`):

- Calls RPC `update_entry_qty_and_status` with `p_client_op_id`.
- The SQL function recomputes `kcal` and writes `client_op_id = p_client_op_id`.
- **Calls** `revalidatePath(`/day/${dayDate}`)`.

Realtime side:

- `UPDATE` with `client_op_id` comes in.
- `RealtimeBridge` sees the op, `ackOp`’s it, and ignores it (no refresh).

Again, the refresh is coming from `revalidatePath`.

#### 1.1.4. Delete entry

Client side:

- `EntryDeleteForm`:
  - On submit:
    - Calls `onDeleteOptimistic(entryId)` so `EntriesList` removes it locally.
    - Generates `opId`, stamps hidden `client_op_id`.
    - Registers pending op `{ id: opId, kind: 'delete', entryIds: [entryId] }`.
    - Lets the form submit to `deleteEntryAction`.

- `DeleteButton` is used with `withRefresh={false}`, so the embedded `ConfirmSubmit` does **not** attach `RefreshOnActionComplete`. That means this path itself does *not* call `router.refresh()`.

Server side (`deleteEntryAction`):

- Calls RPC `delete_entry_with_op` with `p_client_op_id`.
  - SQL function stamps `client_op_id` before deleting so `old.client_op_id` is present.
- **Calls** `revalidatePath(`/day/${dayDate}`)`.

Realtime side:

- A `DELETE` event comes in with `old.client_op_id`.
- `RealtimeBridge` code:
  - Reads `client_op_id` from `new` or `old`.
  - If it matches a pending op, it calls `ackOp` and ignores (no `router.refresh()`).
  - Otherwise, it may fall back to `ackOpByEntryId` or TTL and possibly refresh.

In a normal local delete, again, `RealtimeBridge` should be ignoring the echo and the “full refresh” after a second or two is coming from `revalidatePath`.

### 1.2. Three mechanisms that can refresh the UI

Across the app, you effectively have three refresh mechanisms:

1. **Server Actions → `revalidatePath(...)`**
   - Tells Next “the data for this route is stale; re-render this path on the server and patch the client tree.”

2. **`RefreshOnActionComplete`**
   - React hook that watches the nearest `<form>` with `useFormStatus()`.
   - When the server action settles, it calls `router.refresh()` (with optional debounce) and also calls `markLocalWrite()` so Realtime can ignore echoes.

3. **`RealtimeBridge`**
   - Subscribes to Supabase Realtime events for a table.
   - For non-local events (no `client_op_id` match within TTL), it debounces and calls `router.refresh()`.

On the **day page** specifically:

- You DO NOT use `RefreshOnActionComplete` around the entry forms (you deliberately set `withRefresh={false}` on the delete button and don’t wrap other entry forms with it).
- You DO use `RealtimeBridge` with the opRegistry logic, which usually suppresses refreshes for local operations.
- ALL entry actions (`addEntryFromCatalogAction`, `updateEntryQtyAction`, `updateEntryQtyAndStatusAction`, `deleteEntryAction`, `reorderEntriesAction`) **call `revalidatePath(`/day/${dayDate}`)**.

**Conclusion:**

> The dominant cause of “full refresh on the day page after optimistic updates” is that the day-related server actions still call `revalidatePath('/day/...')`. That forces the entire route to re-render and patch in, undoing the fully optimistic feel.

Realtime is set up to *avoid* refreshing in the local-op cases, but `revalidatePath` doesn’t know about “local vs remote”; it simply invalidates the route.

---

## 2. What “fully optimistic from the start” would look like

Now imagine `/day/[ymd]` had been designed as fully optimistic from day one.

Conceptually, there are two high-level “modes” for pages in this app:

1. **Server-first pages** (Catalog, Goals, Weights, Charts)
2. **Client-first pages** (Day)

### 2.1. Server-first vs client-first

**Server-first pages**:

- Behavior pattern:
  - Submit a form → run server action → `revalidatePath('/page')` → page fully re-renders with the new data.
- Realtime can keep things up to date by simply calling `router.refresh()` on any change.
- There is no client store trying to stay in tight sync; the server RSC tree is the source of truth.

This fits Catalog, Goals, Weights, Charts quite well.

**Client-first page (`/day/[ymd]`)**:

- Desired behavior:
  - Mutations never force a full React tree refresh of the page.
  - The user should feel like they are editing a “live document” where changes stick immediately.
  - The server is for durability, not for driving the live UI.

That leads to a different split of responsibilities.

### 2.2. Single source of truth: client state for this day

For `/day/[ymd]`, the **source of truth for entries** on that page should be:

- **Client state** in `EntriesList` (or a dedicated store), not the server’s latest RSC render.

In other words:

- The server page (`DayPage`) should provide an **initial snapshot** of entries, catalog items, and goal.
- After mount:
  - `EntriesList` owns the entries array.
  - The server does **not** try to replace that array on each write.

This is essentially how your code is already structured: `EntriesList` uses `entries` from props as initial state, then mutates its own copy. The missing piece is: “don’t revalidate the path every time, and don’t use Realtime to trigger `router.refresh()` for entry changes.”

### 2.3. Ideal responsibilities by layer

#### 2.3.1. DayPage (server component)

**Responsibilities:**

- Auth gate, timezone handling, and picking `selectedYMD`.
- Ensuring a `day` exists and retrieving `dayId` (via `get_or_create_day`).
- Fetching initial data:
  - `entries` (for that day)
  - `chipItems` (ordered catalog items)
  - `activeGoal` for `selectedYMD`
- Rendering:
  - `CatalogChipPicker` with its initial ordered item list.
  - `EntriesList` with the initial `entries` and `activeGoalKcal`.
  - Realtime hooks for entries that only inform the client store.

**Crucially:**

- It does *not* assume that “after a mutation, Next will re-render this page.”
- Day-page server actions **do not call** `revalidatePath('/day/...')`.
- Updates to entries are assumed to be handled by the client store + Realtime, not via re-rendered server snapshots.

#### 2.3.2. EntriesList (client component)

**Responsibilities:**

- Holds the entries array in React state and treats the prop as **initial** only.
- Applies **all** mutations optimistically:
  - **Add**: integrally append an entry with known `id`, qty, and kcal.
  - **Qty change**: update `qty` and `kcal_snapshot` optimistically using a per-unit snapshot.
  - **Status change**: toggle `status` and recalculate kcal as needed.
  - **Delete**: remove the entry immediately on click.
  - **Reorder**: reorder locally and send array of ids to the server.

- Starts a “pending op” in the `opRegistry` whenever it fires a commit to the server.
- Shows “Saving…” signals based on `opRegistry` + `useStickyBoolean`.
- Optionally, responds to Realtime events to incorporate **truly remote** changes into the entries state.

This is already very close to what you have; the main conceptual shift is that **no one else** should be trying to own or refresh the entries list.

#### 2.3.3. Server actions for day entries

**Responsibilities:**

- Validate the request and enforce ownership via RLS and/or RPCs.
- Perform the DB mutation (e.g., RPC or `update`, `delete`, etc.).
- Stamp the same `client_op_id` used by the client into the affected rows.
- Return normally (or throw on error) but **do not**:
  - `revalidatePath('/day/...')`
  - Redirect (except in navigation flows unrelated to the day page itself).

Conceptually, they become **commit endpoints**:

> “Given this client op-id, apply the change to the database. The client has already updated its local state; you are just making reality catch up and giving Realtime something to echo back with the same op-id.”

#### 2.3.4. Realtime for entries on the day page

In a fully optimistic design, Realtime is only there to:

1. **Ack local operations**  
   - A matching `client_op_id` means: “This is the server’s echo of something we already applied locally.”
   - Behaviour:
     - `ackOp(opId)`
     - Do **not** call `router.refresh()`
     - Do **not** touch the local entries array (because the client is already in the desired state).

2. **Merge remote operations (optional)**  
   - If an event has no matching op id (and isn’t within the TTL for a local write), then it is likely a remote change (another tab/device/user).
   - Instead of calling `router.refresh()`, the Realtime handler can:
     - `INSERT`: add a new entry to the entries array.
     - `UPDATE`: patch an existing entry’s fields.
     - `DELETE`: remove the entry.
     - Reorder: update `ordering` and reorder the list.

3. **Never call `router.refresh()` on the day page.**  
   - That’s the core difference from a server-first Realtime bridge.

For your **other** pages (Catalog, Goals, Weights, Charts), a “server-first Realtime bridge” that simply calls `router.refresh()` is still fine and arguably simpler. Only the day page needs the more nuanced client-first behavior.

### 2.4. App-wide modes in summary

Think in terms of two categories of pages:

1. **Server-first pages (current behavior is fine):**
   - Catalog (`/catalog`)
   - Goals (`/goals`)
   - Weights (`/weights`)
   - Charts (`/charts`)
   - Behaviour:
     - Server actions call `revalidatePath` for their own page.
     - `RefreshOnActionComplete` can be used liberally.
     - Realtime bridge can call `router.refresh()` on changes.
     - No local entries-style store is trying to own the list.

2. **Client-first page (day page):**
   - `/day/[ymd]`
   - Behaviour:
     - Server actions **do not** call `revalidatePath('/day/...')`.
     - No `RefreshOnActionComplete` is attached to entry forms.
     - Realtime is only used for op-acks and optional incremental merging.
     - `EntriesList` owns the entries array as a client store for the lifetime of the page.

### 2.5. Error handling in a fully optimistic design

In the current hybrid world, “full refresh after server action” tends to mask commit errors or quietly roll the UI back. In a fully optimistic model, you would think more explicitly about failure cases:

- If a server action throws (network error, auth issue, DB rejection):
  - Option A: roll back the optimistic change (requires more bookkeeping).
  - Option B: show a clear error toast / inline message and let the user refresh manually.
- At minimum, errors should clear the pending op from `opRegistry` so “Saving…” doesn’t get stuck.

For a first pass, it’s often sufficient to:

- Keep the optimistic state.
- `alert('Something went wrong. Please refresh the page or try again.')` on error.
- Clear that op from `opRegistry` so your debug overlay doesn’t show stuck ops.

You can refine that later.

---

## 3. Target state for the day page

Putting it all together, the desired architecture for `/day/[ymd]` is:

1. **DayPage is a snapshot provider, not a live owner.**
   - It fetches initial `entries`, `chipItems`, and `activeGoalKcal` and passes them to client components.
   - It does *not* rely on `revalidatePath('/day/...')` being called after each change.

2. **EntriesList is the canonical source of truth for entries in this tab.**
   - It uses the initial `entries` as a starting point.
   - All local edits (add, delete, qty, status, reorder) are applied to its own state immediately.
   - It starts and ends operations via `opRegistry` to drive “Saving…” indicators.

3. **Day-page server actions are fire-and-forget commits.**
   - They validate input, enforce ownership, apply DB changes, and stamp `client_op_id`.
   - They do **not** call `revalidatePath('/day/...')`.
   - They do not redirect (unless handling a flow unrelated to the day page itself).

4. **Realtime on the day page is client-first.**
   - For events with matching `client_op_id`, it just `ackOp`’s them and does nothing else.
   - For events without a match (remote changes), it can optionally patch the local entries array.
   - It **never** calls `router.refresh()` on this route.

5. **Other pages can remain server-first.**
   - Catalog, Goals, Weights, Charts can keep their existing pattern of `revalidatePath` + `RefreshOnActionComplete` + Realtime-driven `router.refresh()`.

Once this target architecture is agreed on, the concrete implementation is mostly a matter of:

- Removing `revalidatePath('/day/...')` from the day actions.
- Ensuring no `RefreshOnActionComplete` is wired to day entry forms.
- Adjusting the `RealtimeBridge` behavior for the day page (or introducing a specialized variant) so that it never calls `router.refresh()` there and instead plays nicely with `EntriesList`’s local state.
