import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createCatalogItemAction, updateCatalogItemAction } from './actions';
import CatalogRow from '@/components/CatalogRow';

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
    .select('id,name,unit,kcal_per_unit,default_qty,created_at')
    .order('name', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-slate-50">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catalog</h1>
        {next && (
          <Link href={next} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">‹ Back to day</Link>
        )}
      </div>

      {/* Add item */}
      <section className="space-y-2">
        <h2 className="font-semibold">Add item</h2>
        <div className="rounded-lg border bg-white p-4">
          <form action={createCatalogItemAction} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 items-end">
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

      {/* Your items */}
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
                <CatalogRow key={it.id} item={it} updateAction={updateCatalogItemAction} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
