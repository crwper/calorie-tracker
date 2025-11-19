'use client';

import { useRouter } from 'next/navigation';

export default function RefreshNowButton({
  label = 'Refresh page data',
  className = 'rounded border px-2 py-1 text-sm hover:bg-control-hover',
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className={className}
      title="Trigger a server re-render of this page"
    >
      {label}
    </button>
  );
}
