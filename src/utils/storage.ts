import { supabase } from '../lib/supabase';

export async function getMe() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('role, custom_role')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return null;
  return { role: data.role, custom: data.custom_role };
}

export async function setMe(m) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('profiles')
    .update({ role: m.role, custom_role: m.custom || '' })
    .eq('id', session.user.id);
}

export async function getAppearance() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('appearance')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return null;
  return data.appearance;
}

export async function setAppearance(v) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('profiles')
    .update({ appearance: v })
    .eq('id', session.user.id);
}

export async function getFamilyExtras() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('family_extras')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return [];
  return data.family_extras || [];
}

export async function setFamilyExtras(list) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('profiles')
    .update({ family_extras: list })
    .eq('id', session.user.id);
}

export function familyCount(kids, extras) {
  const kidCount = Array.isArray(kids) ? kids.length : 0;
  const extraCount = Array.isArray(extras) ? extras.length : 0;
  return kidCount + extraCount + 1;
}
