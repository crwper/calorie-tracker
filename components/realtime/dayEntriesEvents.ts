// components/realtime/dayEntriesEvents.ts
'use client';

export type RemoteEntry = {
  id: string;
  name: string;
  qty: string;
  unit: string;
  kcal_snapshot: number;
  status: 'planned' | 'eaten';
  created_at: string;
  kcal_per_unit_snapshot: number | null;
};

export type DayEntryRemoteEvent =
  | { type: 'insert'; entry: RemoteEntry }
  | { type: 'update'; entry: RemoteEntry }
  | { type: 'delete'; entryId: string };

type Listener = (event: DayEntryRemoteEvent) => void;

const listeners = new Set<Listener>();

export function subscribeToDayEntryRemoteEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitDayEntryRemoteEvent(event: DayEntryRemoteEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[dayEntriesEvents] listener error', err);
    }
  }
}
