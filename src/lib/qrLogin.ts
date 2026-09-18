import { supabase } from './supabase';
import { parseQrApprovalPayload } from './qrLoginPayload';

export { parseQrApprovalCode, parseQrApprovalPayload } from './qrLoginPayload';

export type QrLoginChallenge = {
  id: string;
  qrValue: string;
  pollToken: string;
  expiresAt: string;
};

type PollResult =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'approved'; tokenHash: string };

function functionError(error: any) {
  return new Error(error?.message || 'qr_login_request_failed');
}

export async function createQrLoginChallenge(): Promise<QrLoginChallenge> {
  const { data, error } = await supabase.functions.invoke('qr-login', {
    body: { action: 'create' },
  });
  if (error) throw functionError(error);
  if (!data?.id || !data?.qrValue || !data?.pollToken || !data?.expiresAt) {
    throw new Error('qr_login_invalid_response');
  }
  return data;
}

export async function pollQrLoginChallenge(
  challengeId: string,
  pollToken: string,
): Promise<PollResult> {
  const { data, error } = await supabase.functions.invoke('qr-login', {
    body: { action: 'poll', challengeId, pollToken },
  });
  if (error) throw functionError(error);
  return data as PollResult;
}

export async function approveQrLogin(raw: string) {
  const payload = parseQrApprovalPayload(raw);
  if (!payload) throw new Error('qr_login_invalid_code');
  const { data, error } = await supabase.functions.invoke('qr-login', {
    body: {
      action: 'approve',
      challengeId: payload.challengeId,
      scanToken: payload.scanToken,
    },
  });
  if (error) throw functionError(error);
  if (!data?.approved) throw new Error(data?.error || 'qr_login_approval_failed');
}

export async function completeQrLogin(tokenHash: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (error) throw error;
  return data;
}
