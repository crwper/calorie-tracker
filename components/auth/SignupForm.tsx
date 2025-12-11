'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Alert from '@/components/primitives/Alert';
import PasswordField from '@/components/auth/PasswordField';

function isProbablyEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function SignupForm({
  signupAction,
  initialError,
}: {
  signupAction: (formData: FormData) => Promise<void>;
  initialError?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const clearedRef = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [serverError, setServerError] = useState<string | null>(initialError ?? null);

  useEffect(() => setServerError(initialError ?? null), [initialError]);

  const clearErrorParam = useCallback(() => {
    if (clearedRef.current) return;
    if (!search.has('error')) return;
    clearedRef.current = true;

    const sp = new URLSearchParams(search.toString());
    sp.delete('error');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, search]);

  const onAnyChange = useCallback(() => {
    if (serverError) setServerError(null);
    clearErrorParam();
  }, [serverError, clearErrorParam]);

  const emailOk = useMemo(() => isProbablyEmail(email), [email]);
  const passwordOk = useMemo(() => password.length >= 6, [password]);
  const confirmOk = useMemo(() => confirm.length > 0 && confirm === password, [confirm, password]);

  const emailError = email.length > 0 && !emailOk ? 'Enter a valid email address.' : null;
  const passwordError = password.length > 0 && !passwordOk ? 'Password must be at least 6 characters.' : null;
  const confirmError = confirm.length > 0 && !confirmOk ? 'Passwords do not match.' : null;

  const canSubmit = emailOk && passwordOk && confirmOk;

  return (
    <form
      action={signupAction}
      className="space-y-3"
      onSubmit={(e) => {
        if (!canSubmit) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}

      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">Email</label>
        <input
          name="email"
          type="email"
          required
          className="border rounded px-2 py-1"
          value={email}
          onChange={(e) => { onAnyChange(); setEmail(e.currentTarget.value); }}
          aria-invalid={emailError ? true : undefined}
        />
        {emailError ? (
          <p className="mt-1 text-[11px] text-alert-error-fg">{emailError}</p>
        ) : (
          <p className="mt-1 text-[11px] text-subtle-foreground">We’ll send a confirmation email.</p>
        )}
      </div>

      <PasswordField
        name="password"
        label="Password"
        required
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => { onAnyChange(); setPassword(e.currentTarget.value); }}
        error={passwordError}
      />

      <PasswordField
        name="confirm_password"
        label="Confirm password"
        required
        minLength={6}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => { onAnyChange(); setConfirm(e.currentTarget.value); }}
        error={confirmError}
      />

      <button
        type="submit"
        className={`rounded border px-3 py-1 text-sm hover:bg-control-hover ${!canSubmit ? 'opacity-60 cursor-not-allowed hover:bg-transparent' : ''}`}
        disabled={!canSubmit}
      >
        Sign up
      </button>
    </form>
  );
}
