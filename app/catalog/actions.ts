'use server';

import { revalidatePath } from 'next/cache';
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

  const name = String(formData.get('name') ?? '').trim();
  const unit = String(formData.get('unit') ?? '').trim();
  const kcalPerUnit = okNum(formData.get('kcal_per_unit'));
  const defaultQty = okNum(formData.get('default_qty'));
  const isFavorite = String(formData.get('is_favorite') ?? '') === 'on';

  if (!name || !unit) throw new Error('Name and unit required');

  const { error } = await supabase.from('catalog_items').insert({
    user_id: user.id,
    name,
    unit,
    kcal_per_unit: kcalPerUnit,
    default_qty: defaultQty,
    is_favorite: isFavorite,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/catalog');
  revalidatePath('/'); // chips
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

export async function toggleFavoriteCatalogItemAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('next') ?? '') === 'true';
  if (!id) throw new Error('Missing id');

  const { error } = await supabase
    .from('catalog_items')
    .update({ is_favorite: next })
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
