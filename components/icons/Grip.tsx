// components/icons/Grip.tsx
'use client';
import * as React from 'react';

export default function Grip({
  className = 'text-handle',
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={`select-none ${className}`}
      {...rest}
    >
      ≡
    </span>
  );
}
