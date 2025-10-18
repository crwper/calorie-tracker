'use client';

import { deleteCatalogItemAction } from '@/app/catalog/actions';

export default function DeleteCatalogItemButton({ id }: { id: string }) {
  return (
    <form>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        formAction={deleteCatalogItemAction}
        onClick={(e) => {
          if (!confirm('Delete this catalog item? (Past entries remain unchanged)')) e.preventDefault();
        }}
        className="rounded border px-2 py-1 text-xs hover:bg-red-50"
        title="Delete item"
      >
        🗑️ Delete
      </button>
    </form>
  );
}
