// app/day/today/page.tsx
import Script from 'next/script';
import Alert from '@/components/primitives/Alert';
import TodayClientRedirect from './TodayClientRedirect';

function SkeletonChip({ w = 'w-20' }: { w?: string }) {
  return <div className={`h-8 ${w} rounded border bg-chip-face`} />;
}

function SkeletonRow() {
  return (
    <li className="py-2">
      <div className="grid grid-cols-[44px_1fr_auto] md:grid-cols-[22px_1fr_auto] gap-x-2 gap-y-1">
        <div className="h-11 w-11 md:h-6 md:w-6 rounded border bg-chip-face" />
        <div className="space-y-2">
          <div className="h-4 w-56 rounded bg-control-pressed" />
          <div className="h-3 w-40 rounded bg-control-hover" />
        </div>
        <div className="h-4 w-16 rounded bg-control-pressed justify-self-end mt-1" />
      </div>
    </li>
  );
}

export default function TodayPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-canvas">
      {/* On client-side navigations, beforeInteractive scripts won't rerun.
          This client redirect handles those cases. */}
      <TodayClientRedirect />

      {/* Resolve "today" in the browser *before* React hydration to minimize the flash. */}
      <Script id="snackdragon-resolve-today" strategy="beforeInteractive">
        {`
(function () {
  try {
    var ro = Intl.DateTimeFormat().resolvedOptions();
    if (!ro || !ro.timeZone) throw new Error('timezone-unavailable');

    var d = new Date(); // local device time (reflects travel automatically)
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var ymd = y + '-' + m + '-' + day;

    window.location.replace('/day/' + ymd);
  } catch (e) {
    // Show an explicit error (no timezone fallback).
    var sk = document.getElementById('today-skeleton');
    if (sk) sk.style.display = 'none';
    var err = document.getElementById('tz-required');
    if (err) err.style.display = 'block';
    if (console && console.error) console.error('[day/today] timezone required', e);
  }
})();
        `}
      </Script>

      {/* Error state (hidden unless script fails) */}
      <div id="tz-required" style={{ display: 'none' }} className="space-y-3">
        <h1 className="text-xl font-bold">Timezone required</h1>
        <Alert tone="error">
          We couldn’t determine your timezone in this browser. Please ensure
          JavaScript and Intl time zone support are available, then reload.
        </Alert>
      </div>

      {/* Skeleton placeholder (shown briefly while redirecting) */}
      <div id="today-skeleton" className="animate-pulse space-y-6" aria-busy="true">
        {/* Day header row skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 rounded bg-control-pressed" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded border bg-chip-face" />
            <div className="h-8 w-20 rounded border bg-chip-face" />
            <div className="h-8 w-20 rounded border bg-chip-face" />
          </div>
        </div>

        {/* Add to this day skeleton */}
        <section className="space-y-2">
          <div className="h-5 w-40 rounded bg-control-pressed" />
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <SkeletonChip w="w-24" />
              <SkeletonChip w="w-28" />
              <SkeletonChip w="w-20" />
              <SkeletonChip w="w-32" />
              <SkeletonChip w="w-24" />
              <SkeletonChip w="w-16" />
              <SkeletonChip w="w-28" />
            </div>
            <div className="h-3 w-32 rounded bg-control-hover" />
          </div>
        </section>

        {/* Entries skeleton */}
        <section className="space-y-2">
          <div className="h-5 w-20 rounded bg-control-pressed" />
          <div className="rounded-lg border bg-card p-4">
            <ul className="divide-y">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </ul>

            <div className="pt-3 mt-2 border-t flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-control-hover" />
              <div className="h-4 w-28 rounded bg-control-hover" />
              <div className="h-4 w-28 rounded bg-control-hover" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
