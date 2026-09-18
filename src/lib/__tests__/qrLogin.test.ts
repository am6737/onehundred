import { parseQrApprovalCode, parseQrApprovalPayload } from '../qrLoginPayload';

describe('QR login approval payload parsing', () => {
  it('accepts production and development app challenges', () => {
    expect(parseQrApprovalPayload('moments100://qr-login?challenge=abc&token=secret')).toEqual({
      challengeId: 'abc',
      scanToken: 'secret',
    });
    expect(parseQrApprovalPayload('moments100-dev://qr-login?challenge=dev&token=value')).toEqual({
      challengeId: 'dev',
      scanToken: 'value',
    });
  });

  it.each([
    'https://example.com/qr-login?challenge=abc&token=secret',
    'moments100://qr-login?challenge=abc',
    'moments100://other?challenge=abc&token=secret',
    'not a url',
  ])('rejects untrusted or incomplete payload %s', value => {
    expect(parseQrApprovalCode(value)).toBeNull();
  });
});
