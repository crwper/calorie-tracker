// components/primitives/DeleteButton.tsx
'use client';

import * as React from 'react';
import ConfirmSubmit, { type ConfirmSubmitProps } from './ConfirmSubmit';
import Trash from '@/components/icons/Trash';

type DeleteButtonProps = Omit<
  ConfirmSubmitProps,
  'children' | 'confirmMessage' | 'className'
> & {
  /** Override the default confirm text. */
  confirmMessage?: string;
  /** Size of the icon/button (purely visual). */
  size?: 'sm' | 'md';
};

export default function DeleteButton({
  confirmMessage = 'Delete this item?',
  size = 'sm',
  ...props
}: DeleteButtonProps) {
  const dims = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const klass =
    'inline-flex h-7 w-7 items-center justify-center rounded ' +
    'hover:bg-button-danger-hover focus:outline-none focus:ring-2 focus:ring-danger';

  return (
    <ConfirmSubmit
      {...props}
      confirmMessage={confirmMessage}
      className={klass}
      aria-label={props['aria-label'] ?? 'Delete'}
      title={props.title ?? 'Delete'}
      withRefresh={props.withRefresh ?? 250}
    >
      <Trash className={dims} aria-hidden="true" />
    </ConfirmSubmit>
  );
}
