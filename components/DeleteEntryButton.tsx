'use client';

import { deleteEntryAction } from '@/app/actions';

export default function DeleteEntryButton({ entryId }: { entryId: string }) {
  return (
    <form>
      <input type="hidden" name="entry_id" value={entryId} />
      <button
        type="submit"
        // Client-side confirm; if canceled, prevent the POST
        onClick={(ev) => {
          if (!confirm('Delete this entry?')) ev.preventDefault();
        }}
        // Bind the server action here; Next will POST to it if not prevented
        formAction={deleteEntryAction}
        className="rounded border px-2 py-1 text-xs hover:bg-red-50"
        title="Delete entry"
      >
        🗑️ Delete
      </button>
    </form>
  );
}
