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

export function registerPendingOp(op: PendingOp) {
  pending.set(op.id, op);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[opRegistry] register', op);
  }
}

export function ackOp(id: string) {
  const op = pending.get(id);
  pending.delete(id);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[opRegistry] ack', id, op);
  }
}

export function hasPendingOp(id: string): boolean {
  return pending.has(id);
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
  return matched;
}
