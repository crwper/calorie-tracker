// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { todayYMDVancouver } from '@/lib/dates';

export async function createTodayAction() {
  const supabase = await createClient();
  const today = todayYMDVancouver();

  // Idempotent create: insert-or-update on unique(date).
  // Using upsert avoids race/duplicate issues and returns the row.
  const { error } = await supabase
    .from('days')
    .upsert({ date: today }, { onConflict: 'date' })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function addEntryAction(formData: FormData) {
  const supabase = await createClient();
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
  if (!Number.isInteger(kcal) || kcal <= 0) throw new Error('kcal must be a positive integer');

  const { error } = await supabase.from('entries').insert({
    day_id: day.id,
    name,
    qty,
    unit,
    kcal_snapshot: kcal,
    status,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/');
}
