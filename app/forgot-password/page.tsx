// app/forgot-password/page.tsx
import Link from 'next/link';
import Alert from '@/components/primitives/Alert';
import { requestPasswordResetAction } from '@/app/auth-actions';

export default async function ForgotPasswordPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sent = sp.sent === '1';
  const err = typeof sp.error === 'string' ? sp.error : null;

  return (
    <main className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-bold">Reset your password</h1>

      {sent ? <Alert tone="success">Check your email for a reset link.</Alert> : null}
      {err ? <Alert tone="error">{err}</Alert> : null}

      <form action={requestPasswordResetAction} className="space-y-3">
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Email</label>
          <input name="email" type="email" required className="border rounded px-2 py-1" />
        </div>

        <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-control-hover">
          Send reset link
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        <Link className="underline" href="/login">Back to login</Link>
      </p>
    </main>
  );
}
