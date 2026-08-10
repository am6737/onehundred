import type { PostgrestError } from '@supabase/supabase-js';

import { resolveGovernanceReason } from './governanceSettings';

export type AdminDataErrorCode =
  | 'admin_data_error'
  | 'admin_query_failed'
  | 'admin_permission_denied'
  | 'invalid_admin_input'
  | 'demo_repository_readonly'
  | 'governance_reason_required'
  | 'missing_supabase_config'
  | 'not_admin'
  | 'not_authenticated'
  | 'rpc_not_available'
  | 'unsupported_admin_operation';

export class AdminDataError extends Error {
  readonly code: AdminDataErrorCode | string;
  readonly cause?: unknown;
  readonly metadata?: Record<string, unknown>;

  constructor(message: string, code: AdminDataErrorCode | string = 'admin_data_error', cause?: unknown, metadata?: Record<string, unknown>) {
    super(message);
    this.name = 'AdminDataError';
    this.code = code;
    this.cause = cause;
    this.metadata = metadata;
  }
}

export function isMissingConfigError(error: unknown) {
  return error instanceof AdminDataError && error.code === 'missing_supabase_config';
}

export function isGovernanceReasonRequiredError(error: unknown) {
  return error instanceof AdminDataError && error.code === 'governance_reason_required';
}

export function requireGovernanceReason(reason: string | null | undefined, context: string) {
  const trimmed = resolveGovernanceReason(reason);
  if (!trimmed || trimmed.length < 8) {
    throw new AdminDataError(
      `${context}: governance_reason must be at least 8 characters before reading or mutating governed admin data.`,
      'governance_reason_required',
      undefined,
      { context },
    );
  }
  return trimmed;
}

export function unsupportedAdminOperation(operation: string, message?: string) {
  return new AdminDataError(message ?? `${operation} is not implemented by the current admin data contract.`, 'unsupported_admin_operation', undefined, {
    operation,
  });
}

export function toAdminDataError(error: unknown, context: string) {
  if (error instanceof AdminDataError) return error;

  const postgrest = error as Partial<PostgrestError>;
  const message = postgrest?.message ?? '';
  const lowerMessage = message.toLowerCase();
  if (postgrest?.code === '42501' || lowerMessage.includes('permission denied')) {
    return new AdminDataError(
      `${context}: current anon session is not allowed by Supabase RLS/RPC admin policies.`,
      'admin_permission_denied',
      error,
    );
  }
  if (postgrest?.code === 'PGRST202' || lowerMessage.includes('could not find the function')) {
    return new AdminDataError(
      `${context}: required admin V2 RPC is not available in this Supabase project.`,
      'rpc_not_available',
      error,
    );
  }
  if (message) {
    return new AdminDataError(`${context}: ${message}`, postgrest.code ?? 'admin_query_failed', error);
  }
  if (error instanceof Error) {
    return new AdminDataError(`${context}: ${error.message}`, 'admin_query_failed', error);
  }
  return new AdminDataError(`${context}: unknown admin data failure`, 'admin_query_failed', error);
}
