import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  createCatalogItemAction,
  updateCatalogItemAction,
  toggleFavoriteCatalogItemAction,
} from './actions';
import DeleteCatalogItemButton from '@/components/DeleteCatalogItemButton';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const supabase = await createClient();

  // Auth gate: anonymous → /login?next=/catalog
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
     redirect('/login?next=/catalog');
  }

  const { data: items } = await supabase
    .from('catalog_items')
    .select('id,name,unit,kcal_per_unit,default_qty,is_favorite,created_at')
    .order('is_favorite', { ascending: false })
    .order('name', { ascending: true });

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6 font-sans bg-slate-50">
      <h1 className="text-2xl font-bold">Catalog</h1>

      {/* Create new */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold mb-3">New item</h2>
        <form action={createCatalogItemAction} className="grid grid-cols-6 gap-2 items-end">
          <div className="col-span-2">
            <label className="text-xs text-gray-600">Name</label>
            <input name="name" className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Unit</label>
            <input name="unit" className="w-full border rounded px-2 py-1 text-sm" placeholder="g" />
          </div>
          <div>
            <label className="text-xs text-gray-600">kcal / unit</label>
            <input name="kcal_per_unit" type="number" step="any" min="0" inputMode="decimal"
                   className="w-full border rounded px-2 py-1 text-sm" placeholder="3.6" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Default qty</label>
            <input name="default_qty" type="number" step="any" min="0" inputMode="decimal"
                   className="w-full border rounded px-2 py-1 text-sm" placeholder="130" />
          </div>
          <div className="flex items-center gap-2">
            <input id="fav" name="is_favorite" type="checkbox" className="h-4 w-4" />
            <label htmlFor="fav" className="text-sm">★ Favorite</label>
          </div>
          <div className="col-span-6">
            <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">Create</button>
          </div>
        </form>
      </section>

      {/* List / edit */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold mb-3">Your items</h2>
        <div className="space-y-2">
          {(items ?? []).map((it) => (
            <div key={it.id} className="flex flex-wrap items-end gap-2 border rounded p-2">
              {/* Quick favorite toggle */}
              <form action={toggleFavoriteCatalogItemAction}>
                <input type="hidden" name="id" value={it.id} />
                <input type="hidden" name="next" value={(!it.is_favorite).toString()} />
                <button
                  type="submit"
                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                  title={it.is_favorite ? 'Unfavorite' : 'Favorite'}
                >
                  {it.is_favorite ? '★' : '☆'}
                </button>
              </form>

              {/* Inline edit form */}
              <form action={updateCatalogItemAction} className="flex flex-wrap items-end gap-2 flex-1">
                <input type="hidden" name="id" value={it.id} />
                <div>
                  <label className="text-xs text-gray-600">Name</label>
                  <input name="name" defaultValue={it.name} className="border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Unit</label>
                  <input name="unit" defaultValue={it.unit} className="border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">kcal / unit</label>
                  <input name="kcal_per_unit" type="number" step="any" min="0" inputMode="decimal"
                         defaultValue={String(it.kcal_per_unit)}
                         className="border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Default qty</label>
                  <input name="default_qty" type="number" step="any" min="0" inputMode="decimal"
                         defaultValue={String(it.default_qty)}
                         className="border rounded px-2 py-1 text-sm" />
                </div>
                <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-gray-50">Save</button>
              </form>

              {/* Delete */}
              <DeleteCatalogItemButton id={it.id} />
            </div>
          ))}
          {(items ?? []).length === 0 && (
            <div className="text-sm text-gray-600">No items yet. Create your first above.</div>
          )}
        </div>
      </section>
    </main>
  );
}
