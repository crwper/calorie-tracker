// app/page.tsx
import WhereServer from '@/components/WhereServer';
import WhereClient from '@/components/WhereClient';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4 font-sans bg-slate-50">
      <h1>Hello, Dog Tracker 👋</h1>
      <p>Milestone 2: server vs client components.</p>

      <WhereServer />
      <WhereClient />
    </main>
  );
}
