import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export interface InviteToken {
  id: string;
  familyId: string;
  levelNum: string;
  levelTitle: string;
  kidId: string | null;
  kidName: string | null;
  inviterRole: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

export async function createInviteToken(params: {
  levelNum: string;
  levelTitle: string;
  levelWhy?: string;
  levelHow?: string;
  levelSuggest?: string;
  levelTone?: string;
  kidId?: string;
  kidName?: string;
  inviterRole?: string;
  expiresDays?: number;
}): Promise<{ token: string; url: string; expiresAt: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/yaoji/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchInviteTokens(levelNum: string): Promise<InviteToken[]> {
  const { data, error } = await supabase
    .from('invite_tokens')
    .select('*')
    .eq('level_num', levelNum)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    familyId: row.family_id,
    levelNum: row.level_num,
    levelTitle: row.level_title,
    kidId: row.kid_id,
    kidName: row.kid_name,
    inviterRole: row.inviter_role,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function deactivateInviteToken(tokenId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/yaoji/deactivate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tokenId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}

export function inviteUrl(token: string): string {
  return `${SUPABASE_URL}/functions/v1/yaoji/page/${token}`;
}
