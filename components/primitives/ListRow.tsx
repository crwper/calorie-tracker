// components/primitives/ListRow.tsx
'use client';

import React, { forwardRef } from 'react';

type ListRowProps = {
  handle?: React.ReactNode;
  content: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const ListRow = forwardRef<HTMLLIElement, ListRowProps>(
  ({ handle, content, actions, className = '', style }, ref) => {
    return (
      <li ref={ref} style={style} className={`p-2 flex items-stretch gap-2 ${className}`}>
        <div className="shrink-0 self-stretch">{handle}</div>
        <div className="flex-1">{content}</div>
        <div className="shrink-0 self-stretch flex items-center justify-center min-w-[44px] md:min-w-7">
          {actions}
        </div>
      </li>
    );
  }
);

ListRow.displayName = 'ListRow';
export default ListRow;
