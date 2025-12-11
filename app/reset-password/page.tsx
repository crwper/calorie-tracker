// app/reset-password/page.tsx
import Link from 'next/link';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-bold">Choose a new password</h1>
      <ResetPasswordForm />
      <p className="text-sm text-muted-foreground">
        <Link className="underline" href="/login">Back to login</Link>
      </p>
    </main>
  );
}
