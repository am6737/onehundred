export { createDemoAdminRepository } from './demoRepository';
export { AdminDataError } from './errors';
export { createAdminRepository, createLiveAdminRepository } from './repository';
export { getAdminSupabaseClient, getSupabaseConfigStatus, hasSupabaseConfig } from './supabase';
export { normalizeAdminRole, getCapabilities, hasCapability, assertCapability } from './permissions';
export { SupabaseAdminRepository } from './supabaseRepository';
export type * from './types';

export { automaticDebugGovernanceReason, isGovernanceReasonReady, isManualGovernanceAuthorizationEnabled, resolveGovernanceReason, setManualGovernanceAuthorizationEnabled, useGovernanceAuthorizationSettings } from './governanceSettings';
