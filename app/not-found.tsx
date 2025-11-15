// app/not-found.tsx
import Link from 'next/link';
import { todayYMDVancouver } from '@/lib/dates';

export default function NotFound() {
  const today = todayYMDVancouver();
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-3">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="text-sm text-muted-foreground">This page doesn’t exist.</p>
      <p className="text-sm">
        <Link className="underline" href={`/day/${today}`}>Go to today</Link>
      </p>
    </main>
  );
}
