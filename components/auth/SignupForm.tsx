'use client';

import { useMemo, useState } from 'react';
import Alert from '@/components/primitives/Alert';
import PasswordField from '@/components/auth/PasswordField';

export default function SignupForm({
  signupAction,
}: {
  signupAction: (formData: FormData) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mismatch = useMemo(
    () => confirm.length > 0 && password !== confirm,
    [password, confirm]
  );

  return (
    <form
      action={signupAction}
      className="space-y-3"
      onSubmit={(e) => {
        // Guard against Enter key submits
        if (mismatch) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="flex flex-col">
        <label className="text-xs text-muted-foreground">Email</label>
        <input name="email" type="email" required className="border rounded px-2 py-1" />
      </div>

      <PasswordField
        name="password"
        label="Password"
        required
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
      />

      <PasswordField
        name="confirm_password"
        label="Confirm password"
        required
        minLength={6}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.currentTarget.value)}
        error={mismatch ? 'Passwords do not match.' : null}
      />

      {mismatch ? (
        <Alert tone="error">Passwords do not match.</Alert>
      ) : null}

      <button
        type="submit"
        className="rounded border px-3 py-1 text-sm hover:bg-control-hover"
        disabled={mismatch}
      >
        Sign up
      </button>
    </form>
  );
}
