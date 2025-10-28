// app/day/page.tsx
import { redirect } from 'next/navigation';
import { todayYMDVancouver } from '@/lib/dates';

export default function DayIndex() {
  redirect(`/day/${todayYMDVancouver()}`);
}
