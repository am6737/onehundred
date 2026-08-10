import { AdminDataError } from './errors';
import type { AdminCapability, AdminRole, AdminRoleV2, RoleCapabilitySummary } from './types';

const legacyRoleMap: Record<string, AdminRoleV2> = {
  super_admin: 'system_admin',
  admin: 'system_admin',
  operator: 'content_reviewer',
  support: 'family_support',
};

const capabilityMatrix: Record<AdminRoleV2, AdminCapability[]> = {
  content_editor: ['activity.draft.create', 'activity.draft.update', 'activity.copy_to_family', 'audit.write'],
  content_reviewer: [
    'activity.review.approve',
    'moderation.case.manage',
    'record.view_governed',
    'record.moderate',
    'audit.write',
  ],
  family_support: ['moderation.case.manage', 'record.view_governed', 'family.support', 'audit.view', 'audit.write'],
  system_admin: [
    'activity.draft.create',
    'activity.draft.update',
    'activity.review.approve',
    'activity.version.publish',
    'activity.version.unpublish',
    'activity.version.archive',
    'activity.copy_to_family',
    'moderation.case.manage',
    'record.view_governed',
    'record.moderate',
    'family.support',
    'audit.view',
    'audit.write',
  ],
};

export function normalizeAdminRole(role: AdminRole | string | null | undefined): AdminRoleV2 {
  if (role === 'content_editor' || role === 'content_reviewer' || role === 'family_support' || role === 'system_admin') return role;
  const mapped = role ? legacyRoleMap[role] : undefined;
  if (mapped) return mapped;
  throw new AdminDataError('Signed-in user does not have a recognized admin role.', 'not_admin', undefined, { role });
}

export function getCapabilities(role: AdminRole | string | null | undefined): RoleCapabilitySummary {
  const normalizedRole = normalizeAdminRole(role);
  return {
    role: (role ?? normalizedRole) as AdminRole,
    normalizedRole,
    capabilities: capabilityMatrix[normalizedRole],
  };
}

export function hasCapability(role: AdminRole | string | null | undefined, capability: AdminCapability) {
  return getCapabilities(role).capabilities.includes(capability);
}

export function assertCapability(role: AdminRole | string | null | undefined, capability: AdminCapability, context: string) {
  if (!hasCapability(role, capability)) {
    throw new AdminDataError(`${context}: ${capability} is not allowed for this admin role.`, 'admin_permission_denied', undefined, {
      role,
      capability,
    });
  }
}
