import Link from 'next/link';
import { loginAction } from '../auth-actions';
import Alert from '@/components/primitives/Alert';
import PasswordField from '@/components/auth/PasswordField';
import { safeNextPath } from '@/lib/safeNext';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const checkEmail = !!sp['check-email'];
  const err = typeof sp.error === 'string' ? sp.error : null;
  const next = safeNextPath(sp.next) ?? '/';
  const reset = sp.reset === '1';

  return (
    <main className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-bold">Log in</h1>

      {checkEmail && (
        <Alert tone="success">
          Check your email to confirm your account, then log in.
        </Alert>
      )}

      {reset && (
        <Alert tone="success">
          Password updated. Please log in.
        </Alert>
      )}

      {err && (
        <Alert tone="error">
          <span className="font-medium">Error:</span> {err}
        </Alert>
      )}

      <form action={loginAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />

        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Email</label>
          <input
            name="email"
            type="email"
            required
            className="border rounded px-2 py-1"
          />
        </div>

        <PasswordField
          name="password"
          label="Password"
          required
          autoComplete="current-password"
        />

        <button
          type="submit"
          className="rounded border px-3 py-1 text-sm hover:bg-control-hover"
        >
          Log in
        </button>
      </form>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          No account?{' '}
          <Link className="underline" href="/signup">
            Sign up
          </Link>
        </span>
        <span>
          <Link className="underline" href="/forgot-password">
            Forgot your password?
          </Link>
        </span>
      </div>
    </main>
  );
}
