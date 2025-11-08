// components/primitives/ConfirmSubmit.tsx
'use client';

import * as React from 'react';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';

type HiddenFields = Record<string, string | number | boolean | null | undefined>;

export type ConfirmSubmitProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  // exclude HTML's boolean `hidden` and Next's string `formAction` prop names
  'type' | 'onClick' | 'formAction' | 'hidden'
> & {
  /** Next server action to invoke. */
  formAction: (formData: FormData) => Promise<void>;
  /** Hidden inputs to send with the request (converted to strings). */
  hidden?: HiddenFields;
  /** Confirm dialog message shown on click. */
  confirmMessage?: string;
  /**
   * If true, render only the button + hidden inputs so it can sit INSIDE
   * an existing <form>. Otherwise, this component renders its own <form>.
   */
  inlineInParentForm?: boolean;
  /**
   * If true, inject <RefreshOnActionComplete/>. If a number is provided,
   * it is used as the debounceMs.
   */
  withRefresh?: boolean | number;
  /** Class names for the button. */
  className?: string;
  /** Button contents (icon/label). */
  children?: React.ReactNode;
};

function HiddenInputs({ hidden }: { hidden?: HiddenFields }) {
  if (!hidden) return null;
  return (
    <>
      {Object.entries(hidden).map(([name, value]) =>
        value == null ? null : (
          <input key={name} type="hidden" name={name} value={String(value)} />
        )
      )}
    </>
  );
}

const baseBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded focus:outline-none ' +
  'focus:ring-2 focus:ring-slate-300 hover:bg-gray-50';

export default function ConfirmSubmit({
  formAction,
  hidden,
  confirmMessage = 'Are you sure?',
  inlineInParentForm = false,
  withRefresh = false,
  className = baseBtn,
  children,
  ...buttonProps
}: ConfirmSubmitProps) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Only show confirm for primary (non-modified) clicks that would submit.
      const ok = window.confirm(confirmMessage);
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [confirmMessage]
  );

  const refreshDebounce =
    typeof withRefresh === 'number' ? withRefresh : withRefresh ? 250 : null;

  if (inlineInParentForm) {
    // Inside a parent <form> — still render our hidden inputs + optional refresh watcher.
    return (
      <>
        <HiddenInputs hidden={hidden} />
        <button
          type="submit"
          formAction={formAction}
          onClick={handleClick}
          className={className}
          {...buttonProps}
        >
          {children}
        </button>
        {refreshDebounce != null ? (
          <RefreshOnActionComplete debounceMs={refreshDebounce} />
        ) : null}
      </>
    );
  }

  // Default: render our own <form>.
  return (
    <form action={formAction}>
      <HiddenInputs hidden={hidden} />
      <button
        type="submit"
        onClick={handleClick}
        className={className}
        {...buttonProps}
      >
        {children}
      </button>
      {refreshDebounce != null ? (
        <RefreshOnActionComplete debounceMs={refreshDebounce} />
      ) : null}
    </form>
  );
}
