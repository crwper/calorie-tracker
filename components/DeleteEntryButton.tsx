'use client';

import { deleteEntryAction } from '@/app/actions';

export default function DeleteEntryButton({ entryId, date }: { entryId: string; date?: string }) {
  return (
    <form>
      <input type="hidden" name="entry_id" value={entryId} />
      {date ? <input type="hidden" name="date" value={date} /> : null}
      <button
        type="submit"
        aria-label="Delete entry"
        title="Delete entry"
        // Client-side confirm; if canceled, prevent the POST
        onClick={(ev) => {
          if (!confirm('Delete this entry?')) ev.preventDefault();
       }}
        // Bind the server action here; Next will POST to it if not prevented
        formAction={deleteEntryAction}
        className="inline-flex h-7 w-7 items-center justify-center hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
      >
        {/* simple trash can icon (no extra deps) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </form>
  );
}
