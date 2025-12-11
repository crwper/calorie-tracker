// components/auth/ResetPasswordForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@/components/primitives/Alert';
import PasswordField from '@/components/auth/PasswordField';
import { getBrowserClient } from '@/lib/supabase/client';

export default function ResetPasswordForm() {
  const supabase = getBrowserClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      // Handle PKCE-style links with ?code=...
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.toString());
      }

      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setReady(true);
    };
    void run();
  }, [supabase]);

  const passwordOk = useMemo(() => password.length >= 6, [password]);
  const confirmOk = useMemo(() => confirm.length > 0 && confirm === password, [confirm, password]);
  const canSubmit = hasSession && passwordOk && confirmOk && !saving;

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!hasSession) {
    return (
      <Alert tone="error">
        This reset link is invalid or expired. Please request a new one from “Forgot password”.
      </Alert>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;

        setSaving(true);
        setMsg(null);

        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setMsg({ tone: 'error', text: error.message });
          setSaving(false);
          return;
        }

        // Optional: sign out and send them to login with a friendly message.
        await supabase.auth.signOut();
        router.replace('/login?reset=1');
      }}
    >
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      <PasswordField
        label="New password"
        name="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
        error={password.length > 0 && !passwordOk ? 'Password must be at least 6 characters.' : null}
      />

      <PasswordField
        label="Confirm new password"
        name="confirm_password"
        required
        minLength={6}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.currentTarget.value)}
        error={confirm.length > 0 && !confirmOk ? 'Passwords do not match.' : null}
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className={`rounded border px-3 py-1 text-sm hover:bg-control-hover ${!canSubmit ? 'opacity-60 cursor-not-allowed hover:bg-transparent' : ''}`}
      >
        {saving ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}
