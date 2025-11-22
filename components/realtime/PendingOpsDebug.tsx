// components/realtime/PendingOpsDebug.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  listPendingOps,
  type PendingOp,
} from '@/components/realtime/opRegistry';

export default function PendingOpsDebug() {
  // Don’t render (or mount any hook-using children) in production at all
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return <PendingOpsDebugInner />;
}

function PendingOpsDebugInner() {
  const [ops, setOps] = useState<PendingOp[]>([]);

  useEffect(() => {
    const update = () => {
      setOps(listPendingOps());
    };

    // Initial grab
    update();

    // Poll every 250ms – simple and good enough for a dev widget
    const id = window.setInterval(update, 250);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  // You can either hide when empty or show a “0 pending” pill.
  if (ops.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-2 right-2 z-40 pointer-events-none">
      <div className="pointer-events-auto rounded border bg-card px-2 py-1 shadow-sm text-[10px] text-subtle-foreground max-w-xs">
        <div className="font-semibold text-[11px] mb-1">
          Pending ops: {ops.length}
        </div>
        <ul className="space-y-[2px]">
          {ops.map((op) => {
            const ageMs = Date.now() - op.startedAt;
            const ageSec = Math.floor(ageMs / 1000);
            return (
              <li key={op.id} className="truncate">
                <span className="font-mono">{op.kind}</span>
                <span className="mx-1 text-[9px]">•</span>
                {/* short id so it fits in the pill */}
                <span className="font-mono">{op.id.slice(0, 8)}</span>
                <span className="mx-1 text-[9px] text-muted-foreground">
                  (+{ageSec}s)
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
