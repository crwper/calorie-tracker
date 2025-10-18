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

  const name = String(formData.get('name') ?? '').trim();
  const qty = Number(formData.get('qty') ?? '0');
  const unit = String(formData.get('unit') ?? '').trim();
  const kcal = Number(formData.get('kcal_snapshot') ?? '0');
  const status =
    String(formData.get('status') ?? 'planned') === 'eaten' ? 'eaten' : 'planned';

  if (!name) throw new Error('Name required');
  if (!unit) throw new Error('Unit required');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Qty must be > 0');
  if (!Number.isFinite(kcal) || kcal <= 0) throw new Error('kcal must be a positive number');

  const today = todayYMDVancouver();

  // Ensure today exists and get its id
  const { data: dayId, error: dayErr } = await supabase.rpc('get_or_create_day', { p_date: today });
  if (dayErr) throw new Error(dayErr.message);

  // Atomic append + snapshot handled inside the RPC
  const { error: insErr } = await supabase.rpc('add_entry_with_order', {
    p_day_id: dayId,
    p_name: name,
    p_qty: qty,
    p_unit: unit,
    p_kcal: kcal,
    p_status: status,
  });
  if (insErr) throw new Error(insErr.message);

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
    .update({ catalog_item_id: item.id }) // RPC now sets per-unit snapshot
    .eq('id', entryId);
  if (linkErr) throw new Error(linkErr.message);

  revalidatePath('/');
}

export async function updateEntryQtyAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in');

  const entryId = String(formData.get('entry_id') ?? '');
  const qty = Number(formData.get('qty') ?? '0');
  if (!entryId) throw new Error('Missing entry_id');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Qty must be > 0');

  // Fetch per-unit snapshot (and fall back if missing)
  const { data: entry, error: selErr } = await supabase
    .from('entries')
    .select('id, qty, kcal_snapshot, kcal_per_unit_snapshot')
    .eq('id', entryId)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);
  if (!entry) throw new Error('Entry not found');

  let perUnit = entry.kcal_per_unit_snapshot as unknown as number | null;

  if (perUnit == null) {
    const baseQty = Number(entry.qty) || qty;
    const baseKcal = Number(entry.kcal_snapshot) || 0;
    if (!Number.isFinite(baseQty) || baseQty <= 0) throw new Error('Cannot compute per-unit');
    perUnit = Number((baseKcal / baseQty).toFixed(4));
  }

  const newKcal = Number((qty * Number(perUnit)).toFixed(2));

  const { error: updErr } = await supabase
    .from('entries')
    .update({
      qty,
      kcal_snapshot: newKcal,
      kcal_per_unit_snapshot: perUnit,
    })
    .eq('id', entryId);

  if (updErr) throw new Error(updErr.message);
  revalidatePath('/');
}
