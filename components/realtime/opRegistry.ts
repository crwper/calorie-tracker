// components/realtime/opRegistry.ts
'use client';

export type OpKind =
  | 'add_from_catalog'
  | 'add_manual'
  | 'update_qty'
  | 'update_status'
  | 'update_qty_and_status'
  | 'delete'
  | 'reorder';

export type PendingOp = {
  id: string;
  kind: OpKind;
  // Optional metadata we can extend later
  entryIds?: string[];
  startedAt: number;
};

const pending = new Map<string, PendingOp>();

// Simple subscriber list so UI can react to registry changes
type PendingListener = () => void;
const listeners = new Set<PendingListener>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        // Avoid breaking all listeners because of one bad callback
        console.error('[opRegistry] listener error', err);
      }
    }
  }
}

export function subscribeToPending(listener: PendingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerPendingOp(op: PendingOp) {
  pending.set(op.id, op);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[opRegistry] register', op);
  }
  notify();
}

export function ackOp(id: string) {
  const op = pending.get(id);
  pending.delete(id);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[opRegistry] ack', id, op);
  }
  notify();
}

export function hasPendingOp(id: string): boolean {
  return pending.has(id);
}

/**
 * True if there is any pending op whose entryIds includes the given entry id.
 */
export function hasPendingForEntry(entryId: string): boolean {
  for (const op of pending.values()) {
    if (op.entryIds?.includes(entryId)) {
      return true;
    }
  }
  return false;
}

// Handy for future debugging
export function listPendingOps(): PendingOp[] {
  return Array.from(pending.values());
}

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
    notify();
  }
  return matched;
}
