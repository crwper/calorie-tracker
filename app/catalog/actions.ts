'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function okNum(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error('Value must be a positive number');
  return v;
}

export async function createCatalogItemAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  // Optional return target + intent
  const rawNext = String(formData.get('next') ?? '');
  const next = rawNext.startsWith('/') ? rawNext : null;
  const intent = String(formData.get('intent') ?? 'create');

  const name = String(formData.get('name') ?? '').trim();
  const unit = String(formData.get('unit') ?? '').trim();
  const kcalPerUnit = okNum(formData.get('kcal_per_unit'));
  const defaultQty = okNum(formData.get('default_qty'));

  if (!name || !unit) throw new Error('Name and unit required');

  const { error } = await supabase.from('catalog_items').insert({
    user_id: user.id,
    name,
    unit,
    kcal_per_unit: kcalPerUnit,
    default_qty: defaultQty,
  });
  if (error) throw new Error(error.message);

  // If user chose "Create & return" and provided a safe relative path, go back.
  if (intent === 'create_return' && next) {
    // Revalidate the destination so chips pick up the new item immediately.
    revalidatePath(next);
    redirect(next);
  }

  // Default behavior: stay on catalog
  revalidatePath('/catalog');
  revalidatePath('/'); // chips (root redirects to /day/<today>)
}

export async function updateCatalogItemAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing id');

  const name = String(formData.get('name') ?? '').trim();
  const unit = String(formData.get('unit') ?? '').trim();
  const kcalPerUnit = okNum(formData.get('kcal_per_unit'));
  const defaultQty = okNum(formData.get('default_qty'));

  if (!name || !unit) throw new Error('Name and unit required');

  const { error } = await supabase
    .from('catalog_items')
    .update({
      name,
      unit,
      kcal_per_unit: kcalPerUnit,
      default_qty: defaultQty,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/catalog');
  revalidatePath('/');
}

export async function deleteCatalogItemAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Missing id');

  const { error } = await supabase.from('catalog_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/catalog');
  revalidatePath('/');
}
