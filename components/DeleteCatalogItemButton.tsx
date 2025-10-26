'use client';
 
import { deleteCatalogItemAction } from '@/app/catalog/actions';
 
export default function DeleteCatalogItemButton({
  id,
  inlineInParentForm = false,
}: {
  id: string;
  /** If true, render just the button so it can live inside another <form>. */
  inlineInParentForm?: boolean;
}) {
  const button = (
    <button
      type="submit"
      aria-label="Delete item"
      title="Delete item"
      onClick={(e) => {
        if (!confirm('Delete this catalog item? (Past entries remain unchanged)')) e.preventDefault();
      }}
      formAction={deleteCatalogItemAction}
      className="inline-flex h-7 w-7 items-center justify-center hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
    >
      {/* trash can icon (same visual as day page) */}
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
  );

  if (inlineInParentForm) return button; // rely on parent's hidden <input name="id" ...>

  return (
    <form>
      <input type="hidden" name="id" value={id} />
      {button}
    </form>
  );
}