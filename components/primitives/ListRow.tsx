// components/primitives/ListRow.tsx
import * as React from 'react';

export default function ListRow({
  handle,
  content,
  actions,
  className = '',
}: {
  handle?: React.ReactNode;
  content: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <li className={`p-2 flex items-stretch gap-2 ${className}`}>
      {/* Left: drag handle or spacer */}
      <div className="shrink-0 self-stretch">{handle}</div>

      {/* Middle: main content */}
      <div className="flex-1">{content}</div>

      {/* Right: actions (icon button area) */}
      <div className="shrink-0 self-stretch flex items-center justify-center w-7">
        {actions}
      </div>
    </li>
  );
}
