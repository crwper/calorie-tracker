// app/day/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { todayInTZYMD } from '@/lib/dates';

export default async function DayIndex() {
  const ck = await cookies();
  const tz = ck.get('tz')?.value ?? 'America/Vancouver';
  redirect(`/day/${todayInTZYMD(tz)}`);
}
