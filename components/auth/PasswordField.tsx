'use client';

import * as React from 'react';

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
      <path d="M9.88 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-4.1 5.1" />
      <path d="M6.1 6.1C3.4 8.2 2 12 2 12s3.5 7 10 7c1 0 1.9-.16 2.8-.45" />
    </svg>
  );
}

type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string | null;
};

export default function PasswordField({
  label,
  error,
  className = '',
  ...inputProps
}: PasswordFieldProps) {
  const id = React.useId();
  const [show, setShow] = React.useState(false);

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>

      <div className="relative">
        <input
          {...inputProps}
          id={id}
          type={show ? 'text' : 'password'}
          className={[
            'w-full border rounded px-2 py-1 pr-10',
            error ? 'ring-2 ring-danger' : '',
            className,
          ].join(' ')}
          aria-invalid={error ? true : undefined}
        />

        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded hover:bg-control-hover focus:outline-none focus:ring-2 focus:ring-control-ring"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          title={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>

      {error ? <p className="mt-1 text-[11px] text-alert-error-fg">{error}</p> : null}
    </div>
  );
}
