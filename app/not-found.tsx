import Link from 'next/link';
import { cookies } from 'next/headers';
import { todayInTZYMD } from '@/lib/dates';

export default async function NotFound() {
  const ck = await cookies();
  const tz = ck.get('tz')?.value ?? 'America/Vancouver';
  const today = todayInTZYMD(tz);
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
