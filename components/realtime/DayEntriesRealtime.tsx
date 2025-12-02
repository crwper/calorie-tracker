// components/realtime/DayEntriesRealtime.tsx
'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  hasPendingOp,
  ackOp,
  ackOpByEntryId,
} from '@/components/realtime/opRegistry';
import {
  emitDayEntryRemoteEvent,
  type RemoteEntry,
} from '@/components/realtime/dayEntriesEvents';

type RtState = 'idle' | 'connecting' | 'live' | 'error';
type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE';

type RowWithClientOpId = {
  id?: unknown;
  client_op_id?: string | null;
  [key: string]: unknown;
};

type RtChangePayload = {
  eventType?: PostgresEvent;
  new: RowWithClientOpId | null;
  old: RowWithClientOpId | null;
};

function mapRowToRemoteEntry(row: RowWithClientOpId | null): RemoteEntry | null {
  if (!row) return null;

  const idValue = row.id;
  const id =
    typeof idValue === 'string'
      ? idValue
      : idValue != null
      ? String(idValue)
      : null;

  if (!id) return null;

  const nameRaw = (row as any).name;
  const name =
    typeof nameRaw === 'string' ? nameRaw : String(nameRaw ?? '').trim();
  if (!name) return null;

  const qtyRaw = (row as any).qty;
  const unitRaw = (row as any).unit;
  const kcalRaw = (row as any).kcal_snapshot;
  const statusRaw = (row as any).status;
  const createdRaw = (row as any).created_at;
  const perUnitRaw = (row as any).kcal_per_unit_snapshot;

  const qty = String(qtyRaw ?? '');
  const unit = typeof unitRaw === 'string' ? unitRaw : String(unitRaw ?? '');
  const kcal_snapshot = Number(kcalRaw ?? 0);
  const created_at =
    typeof createdRaw === 'string'
      ? createdRaw
      : new Date().toISOString();
  const kcal_per_unit_snapshot =
    perUnitRaw != null ? Number(perUnitRaw) : null;

  const status = statusRaw === 'eaten' ? 'eaten' : 'planned';

  return {
    id,
    name,
    qty,
    unit,
    kcal_snapshot,
    status,
    created_at,
    kcal_per_unit_snapshot,
  };
}

export default function DayEntriesRealtime({ dayId }: { dayId: string }) {
  const [rtState, setRtState] = useState<RtState>('idle');

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;
    let chan: ReturnType<typeof supabase.channel> | null = null;

    const handleChange = (payload: unknown) => {
      const p = payload as RtChangePayload;
      const eventType = p.eventType;
      const newRow: RowWithClientOpId = p?.new ?? {};
      const oldRow: RowWithClientOpId = p?.old ?? {};

      const rawOp =
        (newRow.client_op_id as string | null | undefined) ??
        (oldRow.client_op_id as string | null | undefined) ??
        null;

      const clientOpId =
        typeof rawOp === 'string' && rawOp.trim()
          ? rawOp.trim()
          : null;

      let ignore = false;
      let matchedLocalOp = false;

      if (clientOpId && hasPendingOp(clientOpId)) {
        matchedLocalOp = true;
        ignore = true;
        ackOp(clientOpId);
      } else if (!clientOpId && eventType === 'DELETE') {
        const idVal = oldRow.id;
        const entryId =
          typeof idVal === 'string'
            ? idVal
            : idVal != null
            ? String(idVal)
            : null;

        if (entryId && ackOpByEntryId(entryId)) {
          matchedLocalOp = true;
          ignore = true;
        }
      }

      console.log('[RT] day entries event', {
        dayId,
        eventType,
        clientOpId,
        matchedLocalOp,
        ignore,
        payload,
      });

      // Local op echo → ignore; client was already updated optimistically.
      if (!eventType || ignore) return;

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const entry = mapRowToRemoteEntry(newRow);
        if (!entry) return;
        emitDayEntryRemoteEvent({
          type: eventType === 'INSERT' ? 'insert' : 'update',
          entry,
        });
      } else if (eventType === 'DELETE') {
        const idVal = oldRow.id;
        const entryId =
          typeof idVal === 'string'
            ? idVal
            : idVal != null
            ? String(idVal)
            : null;
        if (!entryId) return;
        emitDayEntryRemoteEvent({ type: 'delete', entryId });
      }
    };

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) {
        console.log('[RT] day entries: no authenticated user, skipping', {
          dayId,
        });
        return;
      }

      setRtState('connecting');

      type ChannelStatus =
        | 'SUBSCRIBED'
        | 'CLOSED'
        | 'CHANNEL_ERROR'
        | 'TIMED_OUT';

      type PgChannel = {
        on(
          type: 'postgres_changes',
          params: {
            event: PostgresEvent | '*';
            schema: string;
            table?: string;
            filter?: string;
          },
          callback: (payload: unknown) => void
        ): PgChannel;
        subscribe(callback: (status: ChannelStatus) => void): unknown;
      };

      const evs: PostgresEvent[] = ['INSERT', 'UPDATE', 'DELETE'];
      const channelName = `rt-entries-day-${dayId}`;

      let c = supabase.channel(channelName) as unknown as PgChannel;

      for (const ev of evs) {
        c = c.on(
          'postgres_changes',
          {
            event: ev,
            schema: 'public',
            table: 'entries',
            filter: `day_id=eq.${dayId}`,
          },
          handleChange
        );
      }

      const subscribed = c.subscribe((status: ChannelStatus) => {
        if (!mounted) return;
        console.log('[RT] day entries channel status', {
          dayId,
          status,
        });

        if (status === 'SUBSCRIBED') {
          setRtState('live');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRtState('error');
        } else if (status === 'CLOSED') {
          setRtState('idle');
        }
      });

      chan = subscribed as ReturnType<typeof supabase.channel>;
    };

    void run();

    return () => {
      mounted = false;
      if (chan) supabase.removeChannel(chan);
    };
  }, [dayId]);

  // Dev-only indicator (like RealtimeBridge, but entries-only).
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  let label: string = rtState;
  if (rtState === 'connecting') label = 'connecting…';
  if (rtState === 'live') label = 'live';
  if (rtState === 'error') label = 'error (retrying)';

  const dotClass =
    rtState === 'live'
      ? 'bg-emerald-500'
      : rtState === 'connecting'
      ? 'bg-amber-400'
      : rtState === 'error'
      ? 'bg-rose-500 animate-pulse'
      : 'bg-zinc-400';

  return (
    <div className="fixed bottom-2 left-2 z-40 pointer-events-none">
      <div className="flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[10px] text-subtle-foreground shadow-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
          aria-hidden="true"
        />
        <span>Day entries: {label}</span>
      </div>
    </div>
  );
}
