// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { todayYMDVancouver } from '@/lib/dates';

export async function createTodayAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const today = todayYMDVancouver();

  // Atomic get-or-create via RPC (returns the day id)
  const { error } = await supabase.rpc('get_or_create_day', { p_date: today });

  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function addEntryAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const today = todayYMDVancouver();

  const { data: day, error: dayErr } = await supabase
    .from('days')
    .select('id')
    .eq('date', today)
    .maybeSingle();

  if (dayErr) throw new Error(dayErr.message);
  if (!day) throw new Error('No day for today. Create today first.');

  const name = String(formData.get('name') ?? '').trim();
  const qty = Number(formData.get('qty') ?? '0');
  const unit = String(formData.get('unit') ?? '').trim();
  const kcal = Number(formData.get('kcal_snapshot') ?? '0');
  const status = (String(formData.get('status') ?? 'planned') === 'eaten') ? 'eaten' : 'planned';

  if (!name) throw new Error('Name required');
  if (!unit) throw new Error('Unit required');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Qty must be > 0');
  if (!Number.isFinite(kcal) || kcal <= 0) throw new Error('kcal must be a positive number');

  // Atomic append at bottom via RPC (RLS-safe, ownership-checked)
  const { error } = await supabase.rpc('add_entry_with_order', {
    p_day_id: day.id,
    p_name: name,
    p_qty: qty,
    p_unit: unit,
    p_kcal: kcal,
    p_status: status,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function toggleEntryStatusAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const entryId = String(formData.get('entry_id') ?? '');
  const nextStatus = String(formData.get('next_status') ?? 'planned');
  if (!entryId) throw new Error('Missing entry_id');
  if (nextStatus !== 'planned' && nextStatus !== 'eaten') throw new Error('Invalid status');

  // RLS ensures you can only update entries whose day belongs to you
  const { error } = await supabase
    .from('entries')
    .update({ status: nextStatus })
    .eq('id', entryId);

  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function deleteEntryAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const entryId = String(formData.get('entry_id') ?? '');
  if (!entryId) throw new Error('Missing entry_id');

  // RLS ensures you can delete only entries whose parent day belongs to you
  const { error } = await supabase.from('entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);

  revalidatePath('/');
}

export async function moveEntryUpAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const entryId = String(formData.get('entry_id') ?? '');
  if (!entryId) throw new Error('Missing entry_id');

  const { error } = await supabase.rpc('move_entry', { p_entry_id: entryId, p_dir: 'up' });
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function moveEntryDownAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const entryId = String(formData.get('entry_id') ?? '');
  if (!entryId) throw new Error('Missing entry_id');

  const { error } = await supabase.rpc('move_entry', { p_entry_id: entryId, p_dir: 'down' });
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function addEntryFromCatalogAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const itemId = String(formData.get('catalog_item_id') ?? '');
  const mult = Number(formData.get('mult') ?? '1');
  const status = (String(formData.get('status') ?? 'planned') === 'eaten') ? 'eaten' : 'planned';
  if (!itemId) throw new Error('Missing catalog_item_id');
  if (!Number.isFinite(mult) || mult <= 0) throw new Error('Invalid multiplier');

  // Ensure today exists → get day_id
  const today = todayYMDVancouver();
  const { data: dayId, error: dayErr } = await supabase.rpc('get_or_create_day', { p_date: today });
  if (dayErr) throw new Error(dayErr.message);

  // Load item (RLS: only your item is visible)
  const { data: item, error: itemErr } = await supabase
    .from('catalog_items')
    .select('id,name,unit,kcal_per_unit,default_qty')
    .eq('id', itemId)
    .single();

  if (itemErr) throw new Error(itemErr.message);

  const qty = Number(item.default_qty) * mult;
  const kcal = qty * Number(item.kcal_per_unit);

  // Append at bottom atomically (RPC), then tag with catalog_item_id
  const { data: entryId, error: insErr } = await supabase.rpc('add_entry_with_order', {
    p_day_id: dayId,
    p_name: item.name,
    p_qty: qty,
    p_unit: item.unit,
    p_kcal: kcal,
    p_status: status,
  });
  if (insErr) throw new Error(insErr.message);

  // Optional: link the entry back to the catalog item (snapshot is already set)
  const { error: linkErr } = await supabase
    .from('entries')
    .update({ catalog_item_id: item.id })
    .eq('id', entryId);
  if (linkErr) throw new Error(linkErr.message);

  revalidatePath('/');
}

export async function quickAddCatalogAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const raw = String(formData.get('q') ?? '').trim();
  if (!raw) throw new Error('Type an item name');

  // Parse optional leading qty: "130 kibble"
  let qtyOverride: number | null = null;
  let term = raw;
  const m = raw.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (m) {
    qtyOverride = Number(m[1]);
    term = m[2].trim();
  }

  // Simple matching: exact (case-insensitive), else contains (ilike)
  // 1) exact (lower(name) == lower(term))
  let { data: item } = await supabase
    .from('catalog_items')
    .select('id,name,unit,kcal_per_unit,default_qty')
    .ilike('name', term) // Supabase ilike is case-insensitive equals if no % (try exact first)
    .maybeSingle();

  if (!item) {
    // 2) prefix
    const { data: pref } = await supabase
      .from('catalog_items')
      .select('id,name,unit,kcal_per_unit,default_qty')
      .ilike('name', `${term}%`)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    item = pref ?? null;
  }
  if (!item) {
    // 3) substring
    const { data: sub } = await supabase
      .from('catalog_items')
      .select('id,name,unit,kcal_per_unit,default_qty')
      .ilike('name', `%${term}%`)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    item = sub ?? null;
  }
  if (!item) throw new Error(`No catalog match for "${term}"`);

  const today = todayYMDVancouver();
  const { data: dayId, error: dayErr } = await supabase.rpc('get_or_create_day', { p_date: today });
  if (dayErr) throw new Error(dayErr.message);

  const qty = (qtyOverride ?? Number(item.default_qty));
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Invalid qty');
  const kcal = qty * Number(item.kcal_per_unit);

  const { data: entryId, error: insErr } = await supabase.rpc('add_entry_with_order', {
    p_day_id: dayId,
    p_name: item.name,
    p_qty: qty,
    p_unit: item.unit,
    p_kcal: kcal,
    p_status: 'planned',
  });
  if (insErr) throw new Error(insErr.message);

  const { error: linkErr } = await supabase
    .from('entries')
    .update({ catalog_item_id: item.id })
    .eq('id', entryId);
  if (linkErr) throw new Error(linkErr.message);

  revalidatePath('/');
}
