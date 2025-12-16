// app/day/page.tsx
import { redirect } from 'next/navigation';

export default async function DayIndex() {
  // "Today" must be determined in the browser's current timezone.
  redirect('/day/today');
}
