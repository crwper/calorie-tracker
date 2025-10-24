import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  createCatalogItemAction,
  updateCatalogItemAction,
  toggleFavoriteCatalogItemAction,
} from './actions';
import DeleteCatalogItemButton from '@/components/DeleteCatalogItemButton';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === 'string' ? sp.next : null;
  // Safety: only allow relative paths
  const next = rawNext && rawNext.startsWith('/') ? rawNext : null;

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catalog</h1>
        {next && (
          <Link href={next} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">‹ Back to day</Link>
        )}
      </div>

      {/* Add item (mirrors "Add to today") */}
      <section className="space-y-2">
        <h2 className="font-semibold">Add item</h2>
        <div className="rounded-lg border bg-white p-4">
          <form action={createCatalogItemAction} className="grid grid-cols-6 gap-2 items-end">
            {next ? <input type="hidden" name="next" value={next} /> : null}
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
          <div className="col-span-6 flex gap-2">
            <button
              type="submit"
              name="intent"
              value="create"
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
           >
             Create
            </button>
            {next && (
             <button
                type="submit"
               name="intent"
                value="create_return"
               className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                title="Create this item and return to the day you came from"
             >
                Create &amp; return
              </button>
            )}
          </div>
        </form>
        </div>
      </section>

      {/* Your items (mirrors "Entries") */}
      <section className="space-y-2">
        <h2 className="font-semibold">Your items</h2>
        <div className="rounded-lg border bg-white p-4">
          {(items ?? []).length === 0 ? (
            <ul className="divide-y">
              <li className="py-2 text-sm text-gray-600">No items yet. Create your first above.</li>
            </ul>
          ) : (
            <ul className="divide-y">
              {(items ?? []).map((it) => (
                <li key={it.id} className="py-2">
                  <div className="flex flex-wrap items-end gap-2">
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
