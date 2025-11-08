// components/icons/Pencil.tsx
'use client';
import * as React from 'react';

export default function Pencil(
  props: React.SVGProps<SVGSVGElement> & { title?: string }
) {
  const { className = 'h-4 w-4', title, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
