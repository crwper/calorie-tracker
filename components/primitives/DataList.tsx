// components/primitives/DataList.tsx
import * as React from 'react';

export default function DataList({
  as: As = 'ul',
  className = 'divide-y',
  children,
}: {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
}) {
  // Allows <DataList as="div"> if you ever need role="list"
  // while keeping the same default styles.
  return <As className={className}>{children}</As>;
}
