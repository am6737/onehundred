export type AuthErrorTranslationKey =
  | 'emailLogin.invalidCredentials'
  | 'emailLogin.emailNotConfirmed'
  | 'emailLogin.tooManyRequests'
  | 'emailLogin.signupDisabled'
  | 'emailLogin.accountAlreadyExists'
  | 'emailLogin.accountUnavailable'
  | 'emailLogin.emailInvalid'
  | 'emailLogin.weakPassword'
  | 'emailLogin.networkError'
  | 'emailLogin.genericError';

const CODE_TO_KEY: Record<string, AuthErrorTranslationKey> = {
  invalid_credentials: 'emailLogin.invalidCredentials',
  email_not_confirmed: 'emailLogin.emailNotConfirmed',
  over_request_rate_limit: 'emailLogin.tooManyRequests',
  over_email_send_rate_limit: 'emailLogin.tooManyRequests',
  signup_disabled: 'emailLogin.signupDisabled',
  email_provider_disabled: 'emailLogin.signupDisabled',
  email_exists: 'emailLogin.accountAlreadyExists',
  user_already_exists: 'emailLogin.accountAlreadyExists',
  user_banned: 'emailLogin.accountUnavailable',
  email_address_invalid: 'emailLogin.emailInvalid',
  email_address_not_authorized: 'emailLogin.emailInvalid',
  weak_password: 'emailLogin.weakPassword',
};

export function getAuthErrorTranslationKey(error: unknown): AuthErrorTranslationKey {
  const authError = error as { code?: unknown; message?: unknown } | null;
  const code = typeof authError?.code === 'string' ? authError.code : '';
  if (CODE_TO_KEY[code]) return CODE_TO_KEY[code];

  // Network failures do not consistently carry a Supabase error code.
  const message = typeof authError?.message === 'string' ? authError.message.toLowerCase() : '';
  if (message.includes('network') || message.includes('fetch')) {
    return 'emailLogin.networkError';
  }
  if (message.includes('invalid login credentials')) {
    return 'emailLogin.invalidCredentials';
  }

  return 'emailLogin.genericError';
}
