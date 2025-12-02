// components/realtime/opRegistry.ts
'use client';

export type OpKind =
  | 'add_from_catalog'
  | 'update_qty'
  | 'update_qty_and_status'
  | 'delete'
  | 'reorder';

export type PendingOp = {
  id: string;
  kind: OpKind;
  // Entries this op actually touches in the DB (used by Realtime ignore logic)
  entryIds?: string[];
  // Optional subset of entries that should show a "Saving…" indicator.
  // If omitted, we fall back to entryIds.
  savingEntryIds?: string[];
  startedAt: number;
};

const pending = new Map<string, PendingOp>();

// Simple subscription mechanism so React hooks can listen for changes.
const subscribers = new Set<() => void>();

function emitChange() {
  for (const fn of subscribers) {
    try {
      fn();
    } catch (err) {
      console.error('[opRegistry] subscriber error', err);
    }
  }
}

/**
 * Subscribe to any change in the pending-op registry.
 * Returns an unsubscribe function.
 */
export function subscribeToPendingOps(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function registerPendingOp(op: PendingOp) {
  pending.set(op.id, op);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[opRegistry] register', op);
  }
  emitChange();
}

export function ackOp(id: string) {
  const op = pending.get(id);
  if (!op) return;
  pending.delete(id);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[opRegistry] ack', id, op);
  }
  emitChange();
}

export function hasPendingOp(id: string): boolean {
  return pending.has(id);
}

/**
 * True if ANY pending op currently references this entry id.
 */
export function hasPendingOpForEntry(entryId: string): boolean {
  for (const op of pending.values()) {
    if (op.entryIds?.includes(entryId)) return true;
  }
  return false;
}

export function hasSavingOpForEntry(entryId: string): boolean {
  for (const op of pending.values()) {
    const ids = op.savingEntryIds ?? op.entryIds;
    if (ids?.includes(entryId)) return true;
  }
  return false;
}

// Handy for debugging
export function listPendingOps(): PendingOp[] {
  return Array.from(pending.values());
}

/**
 * Acknowledge and clear all ops that mention the given entry id.
 * Returns true if we matched at least one op.
 */
export function ackOpByEntryId(entryId: string): boolean {
  let matched = false;
  for (const [id, op] of pending.entries()) {
    if (op.entryIds?.includes(entryId)) {
      pending.delete(id);
      matched = true;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[opRegistry] ack by entryId', entryId, id, op);
      }
    }
  }
  if (matched) {
    emitChange();
  }
  return matched;
}
