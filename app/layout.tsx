// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link';
import "./globals.css";
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from './auth-actions';

// NEW
import { cookies } from 'next/headers';
import { todayInTZYMD } from '@/lib/dates';
import AppNav from '@/components/AppNav';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Snack Dragon Calorie Counter',
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // NEW: compute "today" in cookie TZ for nav fallback
  const ck = await cookies();
  const tz = ck.get('tz')?.value ?? 'America/Vancouver';
  const todayYMD = todayInTZYMD(tz);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="border-b bg-header">
          <div className="mx-auto max-w-2xl p-3 flex items-center justify-between">
            <Link href="/" className="font-semibold">Snack Dragon Calorie Counter</Link>
            <div className="text-sm">
              {user ? (
                <form action={logoutAction} className="flex items-center gap-3">
                  <span className="text-muted-foreground">Signed in as {user.email}</span>
                  <button type="submit" className="rounded border px-2 py-1 hover:bg-gray-50">Logout</button>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <Link className="underline" href="/login">Login</Link>
                  <Link className="underline" href="/signup">Sign up</Link>
                </div>
              )}
            </div>
          </div>

          {/* NEW: app-level nav, only when authenticated */}
          {user ? <AppNav defaultTodayYMD={todayYMD} /> : null}
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
