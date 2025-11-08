'use client';
import * as React from 'react';

export default function DataList({
  as: As = 'ul',
  className = 'divide-y',
  children,
}: {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
}) {
  return <As className={className}>{children}</As>;
}
