import { getAuthErrorTranslationKey } from '../authError';
import { en } from '../../i18n/locales/en';
import { zh } from '../../i18n/locales/zh';

describe('getAuthErrorTranslationKey', () => {
  it.each([
    ['invalid_credentials', 'emailLogin.invalidCredentials'],
    ['email_not_confirmed', 'emailLogin.emailNotConfirmed'],
    ['over_request_rate_limit', 'emailLogin.tooManyRequests'],
    ['weak_password', 'emailLogin.weakPassword'],
    ['user_already_exists', 'emailLogin.accountAlreadyExists'],
    ['user_banned', 'emailLogin.accountUnavailable'],
  ])('maps %s to %s', (code, expected) => {
    expect(getAuthErrorTranslationKey({ code })).toBe(expected);
  });

  it('recognizes network errors without an auth error code', () => {
    expect(getAuthErrorTranslationKey(new Error('Network request failed')))
      .toBe('emailLogin.networkError');
  });

  it('supports the legacy invalid-credentials message', () => {
    expect(getAuthErrorTranslationKey(new Error('Invalid login credentials')))
      .toBe('emailLogin.invalidCredentials');
  });

  it('falls back to a generic translated message', () => {
    expect(getAuthErrorTranslationKey(new Error('Unexpected failure')))
      .toBe('emailLogin.genericError');
  });

  it('has Chinese and English text for every mapped error', () => {
    const errors = [
      { code: 'invalid_credentials' },
      { code: 'email_not_confirmed' },
      { code: 'over_request_rate_limit' },
      { code: 'signup_disabled' },
      { code: 'user_already_exists' },
      { code: 'user_banned' },
      { code: 'email_address_invalid' },
      { code: 'weak_password' },
      new Error('Network request failed'),
      new Error('Unexpected failure'),
    ];

    for (const error of errors) {
      const key = getAuthErrorTranslationKey(error).replace('emailLogin.', '');
      expect(zh.emailLogin[key]).toEqual(expect.any(String));
      expect(en.emailLogin[key]).toEqual(expect.any(String));
    }
  });
});
