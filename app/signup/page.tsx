import Link from 'next/link';
import { signupAction } from '../auth-actions';
import Alert from '@/components/primitives/Alert';
import SignupForm from '@/components/auth/SignupForm';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const err = typeof sp.error === 'string' ? sp.error : null;

  return (
    <main className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-bold">Create account</h1>

      {err && (
        <Alert tone="error">
          <span className="font-medium">Error:</span> {err}
        </Alert>
      )}

      <SignupForm signupAction={signupAction} initialError={err} />

      <p className="text-sm text-muted-foreground">
        Already have an account? <Link className="underline" href="/login">Log in</Link>
      </p>
    </main>
  );
}
