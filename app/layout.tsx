import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from './auth-actions';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Dog Tracker',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto max-w-2xl p-3 flex items-center justify-between">
            <a href="/" className="font-semibold">Dog Tracker</a>
            <div className="text-sm">
              {user ? (
                <form action={logoutAction} className="flex items-center gap-3">
                  <span className="text-gray-600">Signed in as {user.email}</span>
                  <button type="submit" className="rounded border px-2 py-1 hover:bg-gray-50">Logout</button>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <a className="underline" href="/login">Login</a>
                  <a className="underline" href="/signup">Sign up</a>
                </div>
              )}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
