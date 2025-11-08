// components/icons/Grip.tsx
'use client';
import * as React from 'react';

export default function Grip({
  className = 'text-gray-400',
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
