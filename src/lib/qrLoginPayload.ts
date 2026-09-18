export type QrApprovalPayload = {
  challengeId: string;
  scanToken: string;
};

const APP_SCHEMES = new Set(['moments100:', 'moments100-dev:']);

export function parseQrApprovalPayload(raw: string): QrApprovalPayload | null {
  try {
    const url = new URL(raw.trim());
    if (!APP_SCHEMES.has(url.protocol) || url.hostname !== 'qr-login') return null;
    const challengeId = url.searchParams.get('challenge');
    const scanToken = url.searchParams.get('token');
    if (!challengeId || !scanToken) return null;
    return { challengeId, scanToken };
  } catch {
    return null;
  }
}

export function parseQrApprovalCode(raw: string) {
  return parseQrApprovalPayload(raw) ? raw.trim() : null;
}
