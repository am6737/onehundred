import { getAdminSupabaseClient } from './supabase';
import { AdminDataError, requireGovernanceReason, toAdminDataError } from './errors';
import { assertCapability, getCapabilities, normalizeAdminRole } from './permissions';
import type {
  ActivityDetail,
  ActivityListItem,
  ActivityListOptions,
  ActivityVersion,
  ActivityVersionCommand,
  AdminReadModel,
  AdminRepository,
  AdminRole,
  AdminSupabaseClient,
  AuditEvent,
  AuditEventListOptions,
  AuditLogRow,
  CaptureMode,
  CopySystemActivityToFamilyCommand,
  CreateActivityDraftCommand,
  CreateActivityVersionCommand,
  CreateModerationCaseCommand,
  DashboardSummary,
  Database,
  FamilyRow,
  GovernanceInput,
  Json,
  ListOptions,
  MemoryRow,
  ModerationCase,
  ModerationCaseListOptions,
  ModerationStatus,
  NotificationRow,
  RecordDetail,
  RecordListItem,
  RecordListOptions,
  ResolveModerationCaseCommand,
  RoleCapabilitySummary,
  UpdateActivityDraftCommand,
} from './types';

type MemoryTableRow = Database['public']['Tables']['memories']['Row'];
type UnknownRecord = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const captureModeValues = ['text', 'photo', 'video', 'voice'] as const;
const sourceTypeValues = ['system', 'family'] as const;
const versionStatusValues = ['draft', 'published', 'archived', 'unpublished'] as const;
const activityStatusValues = ['draft', 'published', 'archived', 'unpublished', 'deleted'] as const;
const activityVisibilityValues = ['system', 'family_private', 'governed'] as const;
const moderationKindValues = ['record_review', 'activity_review', 'asset_review', 'family_support', 'policy_violation', 'public_request'] as const;
const moderationStatusValues = ['open', 'in_review', 'resolved', 'rejected', 'closed'] as const;
const moderationTargetValues = ['activity', 'activity_version', 'record', 'asset', 'family'] as const;

function page(options: ListOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  return { from: offset, to: offset + limit - 1, limit, offset };
}

function now() {
  return new Date().toISOString();
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNumberLike(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function invalidInput(context: string, message: string, metadata?: Record<string, unknown>): never {
  throw new AdminDataError(`${context}: ${message}`, 'invalid_admin_input', undefined, { context, ...metadata });
}

function invalidRpcJson(context: string, message: string, metadata?: Record<string, unknown>): never {
  throw new AdminDataError(`${context}: ${message}`, 'admin_query_failed', undefined, { context, ...metadata });
}

function requireText(value: unknown, field: string, context: string, options: { min?: number; max?: number } = {}) {
  const min = options.min ?? 1;
  const max = options.max ?? 5000;
  if (typeof value !== 'string') invalidInput(context, `${field} must be a string.`, { field });
  const trimmed = value.trim();
  if (trimmed.length < min) invalidInput(context, `${field} must be at least ${min} character${min === 1 ? '' : 's'}.`, { field, min });
  if (trimmed.length > max) invalidInput(context, `${field} must be at most ${max} characters.`, { field, max });
  return trimmed;
}

function requireUuid(value: unknown, field: string, context: string) {
  const text = requireText(value, field, context, { min: 36, max: 36 });
  if (!uuidPattern.test(text)) invalidInput(context, `${field} must be a V2 UUID.`, { field });
  return text;
}

function optionalUuid(value: unknown, field: string, context: string) {
  if (value === undefined || value === null || value === '') return null;
  return requireUuid(value, field, context);
}

function requireOneOf<T extends string>(value: unknown, values: readonly T[], field: string, context: string): T {
  if (typeof value === 'string' && values.includes(value as T)) return value as T;
  invalidInput(context, `${field} has an unsupported value.`, { field, value, allowed: [...values] });
}

function optionalOneOf<T extends string>(value: unknown, values: readonly T[], field: string, context: string): T | null {
  if (value === undefined || value === null || value === '' || value === 'all') return null;
  return requireOneOf(value, values, field, context);
}

function requireCaptureModes(value: unknown, context: string) {
  if (!Array.isArray(value)) invalidInput(context, 'allowedCaptureModes must be an array.', { field: 'allowedCaptureModes' });
  const modes = Array.from(new Set(value.map((item) => requireOneOf(item, captureModeValues, 'allowedCaptureModes', context))));
  if (!modes.length) invalidInput(context, 'allowedCaptureModes must contain at least one capture mode.', { field: 'allowedCaptureModes' });
  return modes;
}

function optionalStringArray(value: unknown, field: string, context: string) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) invalidInput(context, `${field} must be an array of strings.`, { field });
  return value.map((item) => requireText(item, field, context, { max: 120 }));
}

function optionalSmallAge(value: unknown, field: string, context: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 18) {
    invalidInput(context, `${field} must be an integer from 0 to 18.`, { field, value });
  }
  return value;
}

function optionalJsonRecord(value: unknown, field: string, context: string): Record<string, Json> | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidInput(context, `${field} must be a JSON object.`, { field });
  return value as Record<string, Json>;
}

function firstRpcRow(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function requiredRpcString(row: UnknownRecord, field: string, context: string) {
  const value = row[field];
  if (typeof value !== 'string' || !value.trim()) invalidRpcJson(context, `RPC response is missing ${field}.`, { field });
  return value;
}

function normalizeCaptureMode(value: unknown): CaptureMode {
  if (value === 'voice' || value === 'photo' || value === 'video' || value === 'text') return value;
  return 'photo';
}

function legacyModerationToV2(status: ModerationStatus | string | null | undefined) {
  if (status === 'removed') return 'hidden';
  if (status === 'flagged') return 'rejected';
  if (status === 'pending' || status === 'approved') return status;
  return null;
}

function v2ModerationToLegacy(status: string): ModerationStatus {
  if (status === 'hidden') return 'removed';
  if (status === 'rejected') return 'flagged';
  if (status === 'pending' || status === 'approved' || status === 'flagged' || status === 'removed') return status;
  return 'pending';
}

function mapMemory(row: MemoryTableRow): MemoryRow {
  return {
    id: row.id,
    familyId: row.family_id,
    userId: row.user_id,
    kidId: row.kid_id,
    levelNum: row.level_num,
    perspective: row.perspective,
    type: row.type,
    title: row.title,
    caption: row.caption,
    transcript: row.transcript,
    sealed: row.sealed,
    moderationStatus: row.moderation_status,
    moderationNote: row.moderation_note ?? '',
    createdAt: row.created_at,
    readStatus: 'live',
  };
}

function memoryFromRecord(record: RecordListItem): MemoryRow {
  return {
    id: record.id,
    familyId: record.family_id,
    userId: record.recorded_by,
    kidId: record.kid_id,
    levelNum: record.activity_id,
    perspective: 'together',
    type: record.primary_capture_mode,
    title: record.title ?? record.snapshot.activity_title,
    caption: record.caption ?? '',
    transcript: record.transcript ?? null,
    sealed: record.sealed === 'sealed',
    moderationStatus: v2ModerationToLegacy(record.moderation_status ?? ''),
    moderationNote: record.moderation_note ?? '',
    createdAt: record.created_at,
    readStatus: 'live',
  };
}

function familyFromRpc(value: unknown): FamilyRow {
  const row = asRecord(value);
  return {
    id: asString(row.id),
    createdBy: asString(row.created_by ?? row.createdBy),
    inviteCode: asString(row.invite_code ?? row.inviteCode),
    createdAt: asString(row.created_at ?? row.createdAt),
    memberCount: typeof row.member_count === 'number' ? row.member_count : undefined,
    kidCount: typeof row.kid_count === 'number' ? row.kid_count : undefined,
    memoryCount: typeof row.memory_count === 'number' ? row.memory_count : undefined,
    readStatus: 'live',
  };
}

function mapNotification(value: unknown): NotificationRow {
  const row = asRecord(value);
  const sentCount = row.sent_count ?? row.sentCount;
  return {
    id: asNumberLike(row.id),
    event: asString(row.event),
    familyId: asString(row.family_id ?? row.familyId),
    kidId: asNullableString(row.kid_id ?? row.kidId),
    status: row.status === 'processing' || row.status === 'done' || row.status === 'dead' ? row.status : 'pending',
    attempts: asNumberLike(row.attempts),
    maxAttempts: asNumberLike(row.max_attempts ?? row.maxAttempts),
    sentCount: sentCount === undefined || sentCount === null ? null : asNumberLike(sentCount),
    lastError: asNullableString(row.last_error ?? row.lastError),
    createdAt: asString(row.created_at ?? row.createdAt),
    processedAt: asNullableString(row.processed_at ?? row.processedAt),
  };
}

function mapAuditLog(row: Database['public']['Tables']['admin_audit_log']['Row']): AuditLogRow {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

function recordFromRpc(value: unknown): RecordListItem {
  const row = asRecord(value);
  const snapshot = asRecord(row.snapshot);
  const primary = normalizeCaptureMode(row.primary_capture_mode ?? row.type);
  const captureModes = asStringArray(row.capture_modes).map(normalizeCaptureMode);
  return {
    id: asString(row.id),
    family_id: asString(row.family_id),
    kid_id: asString(row.kid_id),
    activity_id: asString(row.activity_id ?? row.level_num),
    activity_version_id: asString(row.activity_version_id ?? `legacy:${asString(row.level_num)}`),
    recorded_by: asString(row.recorded_by ?? row.user_id),
    primary_capture_mode: primary,
    capture_modes: captureModes.length ? captureModes : [primary],
    title: asNullableString(row.title),
    caption: asNullableString(row.caption),
    transcript: asNullableString(row.transcript),
    duration: typeof row.duration === 'number' || typeof row.duration === 'string' ? row.duration : null,
    shots: typeof row.shots === 'number' ? row.shots : null,
    place: asNullableString(row.place),
    recorded_at: asString(row.recorded_at ?? row.date ?? row.created_at),
    sealed: row.sealed === true || row.sealed === 'sealed' ? 'sealed' : 'unsealed',
    seal_until: asNullableString(row.seal_until),
    seal_label: asNullableString(row.seal_label),
    moderation_status: legacyModerationToV2(asString(row.moderation_status)) ?? null,
    moderation_note: asNullableString(row.moderation_note),
    snapshot: {
      activity_title: asString(snapshot.activity_title ?? row.activity_title ?? row.title),
      activity_why: asString(snapshot.activity_why ?? row.activity_why),
      activity_how: asString(snapshot.activity_how ?? row.activity_how),
      record_hint: asString(snapshot.record_hint ?? row.record_hint),
      suggest_mode: normalizeCaptureMode(snapshot.suggest_mode ?? row.suggest_mode ?? row.type),
      allowed_capture_modes: asStringArray(snapshot.allowed_capture_modes).map(normalizeCaptureMode),
      illustration_source:
        snapshot.illustration_source === 'system_asset' ||
        snapshot.illustration_source === 'family_private' ||
        snapshot.illustration_source === 'motif_fallback' ||
        snapshot.illustration_source === 'none'
          ? snapshot.illustration_source
          : null,
    },
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at ?? row.created_at),
    media_count: asNumber(row.media_count, 0),
    media_kinds: asStringArray(row.media_kinds).filter(
      (kind): kind is RecordListItem['media_kinds'] extends Array<infer K> ? K : never =>
        kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'text' || kind === 'other',
    ),
    read_model_source: asString(row.read_model_source, 'governed_rpc') as RecordListItem['read_model_source'],
  };
}

function activityVersionFromRpc(value: unknown, context = 'Map activity version RPC response'): ActivityVersion {
  const row = asRecord(value);
  const illustration = asRecord(row.illustration);
  const suggestMode = normalizeCaptureMode(row.suggest_mode);
  const allowedCaptureModes = Array.from(new Set(asStringArray(row.allowed_capture_modes).map(normalizeCaptureMode)));
  if (!allowedCaptureModes.includes(suggestMode)) allowedCaptureModes.unshift(suggestMode);

  return {
    id: requiredRpcString(row, 'id', context),
    activity_id: requiredRpcString(row, 'activity_id', context),
    version_no: asNumber(row.version_no ?? row.version, 1),
    status: requireOneOf(row.status ?? 'draft', versionStatusValues, 'status', context),
    title: asString(row.title),
    why: asString(row.why),
    how: asString(row.how),
    record_hint: asString(row.record_hint ?? row.record),
    suggest_mode: suggestMode,
    allowed_capture_modes: allowedCaptureModes.length ? allowedCaptureModes : [suggestMode],
    illustration: row.illustration
      ? {
          asset_id: asNullableString(illustration.asset_id),
          source:
            illustration.source === 'system_asset' ||
            illustration.source === 'family_private' ||
            illustration.source === 'motif_fallback' ||
            illustration.source === 'none'
              ? illustration.source
              : 'none',
          path: asNullableString(illustration.path),
          storage_bucket: asNullableString(illustration.storage_bucket ?? illustration.bucket),
          storage_path: asNullableString(illustration.storage_path),
          mime_type: asNullableString(illustration.mime_type ?? illustration.mime),
          width: typeof illustration.width === 'number' ? illustration.width : null,
          height: typeof illustration.height === 'number' ? illustration.height : null,
          alt: asNullableString(illustration.alt),
          metadata:
            illustration.metadata && typeof illustration.metadata === 'object' && !Array.isArray(illustration.metadata)
              ? (illustration.metadata as Record<string, unknown>)
              : null,
        }
      : null,
    family_id: asNullableString(row.family_id),
    perspective: row.perspective === 'parent' || row.perspective === 'child' || row.perspective === 'together' ? row.perspective : null,
    tone: asNullableString(row.tone),
    category: asNullableString(row.category),
    scene: asNullableString(row.scene),
    tags: Array.isArray(row.tags) ? asStringArray(row.tags) : null,
    min_age: typeof row.min_age === 'number' ? row.min_age : null,
    max_age: typeof row.max_age === 'number' ? row.max_age : null,
    seasonal: typeof row.seasonal === 'boolean' ? row.seasonal : null,
    seal_recommendation: row.seal_recommendation && typeof row.seal_recommendation === 'object' && !Array.isArray(row.seal_recommendation)
      ? (row.seal_recommendation as ActivityVersion['seal_recommendation'])
      : null,
    published_at: asNullableString(row.published_at),
    published_by: asNullableString(row.published_by),
    drafted_by: asNullableString(row.drafted_by),
    review_approved_at: asNullableString(row.review_approved_at),
    review_approved_by: asNullableString(row.review_approved_by),
    copied_from_version_id: asNullableString(row.copied_from_version_id),
    created_at: asString(row.created_at, now()),
    updated_at: asString(row.updated_at ?? row.created_at, now()),
  };
}

function activityListItemFromRpc(value: unknown, context = 'Map activity list RPC response'): ActivityListItem {
  const row = asRecord(value);
  const copiedFrom = asRecord(row.copied_from);
  const currentVersion = row.current_version && typeof row.current_version === 'object' ? activityVersionFromRpc(row.current_version, context) : null;
  const sourceType = requireOneOf(row.source_type, ['system', 'family', 'copied_family'] as const, 'source_type', context);

  return {
    id: requiredRpcString(row, 'id', context),
    source_type: sourceType,
    source_key: asString(row.source_key),
    display_no: asNullableString(row.display_no),
    family_id: asNullableString(row.family_id),
    created_by: asString(row.created_by),
    created_at: asString(row.created_at, now()),
    updated_at: asString(row.updated_at ?? row.created_at, now()),
    current_version_id: asNullableString(row.current_version_id),
    status: requireOneOf(row.status ?? 'draft', activityStatusValues, 'status', context),
    visibility: requireOneOf(row.visibility ?? (sourceType === 'system' ? 'system' : 'family_private'), activityVisibilityValues, 'visibility', context),
    copied_from:
      row.copied_from && typeof row.copied_from === 'object'
        ? {
            activity_id: asString(copiedFrom.activity_id),
            activity_version_id: asNullableString(copiedFrom.activity_version_id),
          }
        : null,
    current_version: currentVersion,
    read_model_source: asString(row.read_model_source, 'activities_v2') as ActivityListItem['read_model_source'],
  };
}

function activityDetailFromRpc(value: unknown, context = 'Map activity detail RPC response'): ActivityDetail {
  const row = asRecord(value);
  const item = activityListItemFromRpc(row, context);
  const versions = Array.isArray(row.versions)
    ? row.versions.map((version) => activityVersionFromRpc(version, context))
    : item.current_version
      ? [item.current_version]
      : [];
  const auditMetadata = asRecord(row.audit_metadata);

  return {
    ...item,
    current_version: item.current_version,
    versions,
    audit_metadata: {
      read_model_source: asString(auditMetadata.read_model_source ?? row.read_model_source, 'activities_v2') as ActivityListItem['read_model_source'],
      compatibility_note: asNullableString(auditMetadata.compatibility_note),
    },
  };
}

function moderationCaseFromRpc(value: unknown, context = 'Map moderation case RPC response'): ModerationCase {
  const row = asRecord(value);
  return {
    id: requiredRpcString(row, 'id', context),
    kind: requireOneOf(row.kind, moderationKindValues, 'kind', context),
    status: requireOneOf(row.status, moderationStatusValues, 'status', context),
    reason: asString(row.reason),
    target_type: requireOneOf(row.target_type, moderationTargetValues, 'target_type', context),
    target_id: asString(row.target_id),
    family_id: asNullableString(row.family_id),
    opened_by: asString(row.opened_by),
    assigned_to: asNullableString(row.assigned_to),
    opened_at: asString(row.opened_at, now()),
    resolved_at: asNullableString(row.resolved_at),
    resolution_note: asNullableString(row.resolution_note),
    audit_event_id: asNullableString(row.audit_event_id),
  };
}

function governanceReasonFromCommand(input: { governanceReason?: string; reason?: string }, context: string) {
  return requireGovernanceReason(input.governanceReason ?? input.reason, context);
}

const activityVersionPatchKeys = new Set([
  'title',
  'why',
  'how',
  'record_hint',
  'suggest_mode',
  'allowed_capture_modes',
  'illustration',
  'family_id',
  'perspective',
  'tone',
  'category',
  'scene',
  'tags',
  'min_age',
  'max_age',
  'seasonal',
  'seal_recommendation',
]);

function activityVersionPatch(input: Partial<ActivityVersion>, context: string, options: { allowEmpty?: boolean } = {}): Json {
  for (const key of Object.keys(input)) {
    if (!activityVersionPatchKeys.has(key)) invalidInput(context, `${key} cannot be sent in an activity version patch.`, { field: key });
  }

  const patch: Record<string, Json> = {};

  if (input.title !== undefined) patch.title = requireText(input.title, 'title', context, { max: 160 });
  if (input.why !== undefined) patch.why = requireText(input.why, 'why', context, { max: 2000 });
  if (input.how !== undefined) patch.how = requireText(input.how, 'how', context, { max: 4000 });
  if (input.record_hint !== undefined) patch.record_hint = requireText(input.record_hint, 'record_hint', context, { max: 1000 });
  if (input.suggest_mode !== undefined) patch.suggest_mode = requireOneOf(input.suggest_mode, captureModeValues, 'suggest_mode', context);
  if (input.allowed_capture_modes !== undefined) patch.allowed_capture_modes = requireCaptureModes(input.allowed_capture_modes, context);
  if (input.illustration !== undefined) patch.illustration = optionalJsonRecord(input.illustration, 'illustration', context) ?? null;
  if (input.family_id !== undefined) patch.family_id = optionalUuid(input.family_id, 'family_id', context);
  if (input.perspective !== undefined) patch.perspective = optionalOneOf(input.perspective, ['parent', 'child', 'together'] as const, 'perspective', context);
  if (input.tone !== undefined) patch.tone = input.tone === null ? null : requireText(input.tone, 'tone', context, { max: 80 });
  if (input.category !== undefined) patch.category = input.category === null ? null : requireText(input.category, 'category', context, { max: 80 });
  if (input.scene !== undefined) patch.scene = input.scene === null ? null : requireText(input.scene, 'scene', context, { max: 80 });
  if (input.tags !== undefined) patch.tags = optionalStringArray(input.tags, 'tags', context) ?? null;
  if (input.min_age !== undefined) patch.min_age = optionalSmallAge(input.min_age, 'min_age', context) ?? null;
  if (input.max_age !== undefined) patch.max_age = optionalSmallAge(input.max_age, 'max_age', context) ?? null;
  if (input.seasonal !== undefined) {
    if (input.seasonal !== null && typeof input.seasonal !== 'boolean') invalidInput(context, 'seasonal must be a boolean.', { field: 'seasonal' });
    patch.seasonal = input.seasonal;
  }
  if (input.seal_recommendation !== undefined) {
    patch.seal_recommendation = optionalJsonRecord(input.seal_recommendation, 'seal_recommendation', context) ?? null;
  }

  if (patch.suggest_mode && patch.allowed_capture_modes && !asStringArray(patch.allowed_capture_modes).includes(String(patch.suggest_mode))) {
    invalidInput(context, 'suggest_mode must be included in allowed_capture_modes.', { field: 'suggest_mode' });
  }
  if (typeof patch.min_age === 'number' && typeof patch.max_age === 'number' && patch.max_age < patch.min_age) {
    invalidInput(context, 'max_age must be greater than or equal to min_age.', { field: 'max_age' });
  }
  if (!options.allowEmpty && Object.keys(patch).length === 0) invalidInput(context, 'patch must include at least one supported field.', { field: 'patch' });

  return patch;
}

async function requireAdminUser(client: AdminSupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw toAdminDataError(error, 'Load admin user');
  if (!data.user) throw new AdminDataError('Admin session is required for live admin repository access.', 'not_authenticated');
  return data.user;
}

async function requireAdminRole(client: AdminSupabaseClient): Promise<AdminRole> {
  const user = await requireAdminUser(client);
  const { data, error } = await client.from('profiles').select('admin_role').eq('id', user.id).single();
  if (error) throw toAdminDataError(error, 'Load admin role');
  if (!data?.admin_role) throw new AdminDataError('Signed-in user does not have profiles.admin_role for admin access.', 'not_admin');
  return data.admin_role;
}

function readModel<T>(items: T[], source: 'live' | 'demo' = 'live', governanceReason?: string): AdminReadModel<T> {
  return {
    status: source,
    source,
    generatedAt: now(),
    items,
    governanceReason,
  };
}

export class SupabaseAdminRepository implements AdminRepository {
  readonly mode = 'live' as const;
  private readonly client: AdminSupabaseClient;
  private readonly activitySourceById = new Map<string, ActivityListItem['source_type']>();

  constructor(client = getAdminSupabaseClient()) {
    this.client = client;
  }

  async getPermissionSummary(role?: AdminRole): Promise<RoleCapabilitySummary> {
    try {
      return getCapabilities(role ?? (await requireAdminRole(this.client)));
    } catch (error) {
      throw toAdminDataError(error, 'Load permission summary');
    }
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const { data, error } = await this.client.rpc('admin_v2_dashboard_summary');
      if (error) throw error;
      const row = asRecord(data);
      const totals = asRecord(row.totals);
      const daily = Array.isArray(row.daily) ? row.daily.map(asRecord) : [];
      return {
        source: 'live',
        generatedAt: asString(row.generatedAt ?? row.generated_at, now()),
        totals: {
          users: asNumber(totals.users),
          families: asNumber(totals.families),
          kids: asNumber(totals.kids),
          memories: asNumber(totals.memories ?? totals.records),
          pendingReview: asNumber(totals.pendingReview ?? totals.pending_review),
          notificationQueue: asNumber(totals.notificationQueue ?? totals.notification_queue),
          systemActivities: asNumber(totals.systemActivities ?? totals.system_activities),
          familyActivities: asNumber(totals.familyActivities ?? totals.family_activities),
          publishedVersions: asNumber(totals.publishedVersions ?? totals.published_versions),
          moderationCases: asNumber(totals.moderationCases ?? totals.moderation_cases),
          auditEvents: asNumber(totals.auditEvents ?? totals.audit_events),
        },
        daily: daily.map((item) => ({
          day: asString(item.day),
          newUsers: asNumber(item.newUsers ?? item.new_users),
          newMemories: asNumber(item.newMemories ?? item.new_memories ?? item.new_records),
          activeFamilies: asNumber(item.activeFamilies ?? item.active_families),
        })),
      };
    } catch (error) {
      throw toAdminDataError(error, 'Load admin V2 dashboard summary');
    }
  }

  async listActivities(options: ActivityListOptions = {}) {
    try {
      const range = page(options);
      const sourceType = options.sourceType ?? 'system';
      const wantsFamily = options.sourceType === 'family' || options.sourceType === 'copied_family';
      if (wantsFamily) {
        const governanceReason = requireGovernanceReason(options.governanceReason, 'List family-private activities');
        const { data, error } = await this.client.rpc('admin_v2_list_family_activities', {
          governance_reason: governanceReason,
          p_limit: range.limit,
          p_offset: range.offset,
          p_search: options.search ?? null,
        });
        if (error) throw error;
        const familyItems = (data ?? []).map((item) => activityListItemFromRpc(item, 'List family-private activities'));
        this.rememberActivitySources(familyItems);
        return readModel(familyItems, 'live', governanceReason);
      }

      const { data: systemData, error: systemError } = await this.client.rpc('admin_v2_list_system_activities', {
        p_limit: range.limit,
        p_offset: range.offset,
        p_search: options.search ?? null,
      });
      if (systemError) throw systemError;
      const systemItems = (systemData ?? []).map((item) => activityListItemFromRpc(item, 'List system activities'));
      this.rememberActivitySources(systemItems);

      if (sourceType !== 'all') return readModel(systemItems);

      const governanceReason = requireGovernanceReason(options.governanceReason, 'List all activities');
      const { data: familyData, error: familyError } = await this.client.rpc('admin_v2_list_family_activities', {
        governance_reason: governanceReason,
        p_limit: range.limit,
        p_offset: range.offset,
        p_search: options.search ?? null,
      });
      if (familyError) throw familyError;
      const familyItems = (familyData ?? []).map((item) => activityListItemFromRpc(item, 'List all family-private activities'));
      this.rememberActivitySources(familyItems);
      return readModel([...systemItems, ...familyItems], 'live', governanceReason);
    } catch (error) {
      throw toAdminDataError(error, 'List activities');
    }
  }

  async getActivityDetail(activityId: string, options?: GovernanceInput): Promise<ActivityDetail> {
    try {
      const systemActivityId = activityId.startsWith('system-level:') ? activityId.replace('system-level:', '') : activityId;
      const cachedSourceType = this.activitySourceById.get(activityId);
      const wantsSystemDetail = cachedSourceType === 'system' || activityId.startsWith('system-level:') || (!cachedSourceType && !options?.governanceReason);
      if (wantsSystemDetail) {
        const { data, error } = await this.client.rpc('admin_v2_get_system_activity', {
          p_activity_id: systemActivityId,
        });
        if (error) throw error;
        const detail = activityDetailFromRpc(data, 'Get system activity detail');
        this.rememberActivitySources([detail]);
        return detail;
      }

      const governanceReason = requireGovernanceReason(options?.governanceReason, 'Get family-private activity detail');
      const { data, error } = await this.client.rpc('admin_v2_get_family_activity', {
        p_activity_id: activityId,
        governance_reason: governanceReason,
      });
      if (error) throw error;
      const detail = activityDetailFromRpc(data, 'Get family-private activity detail');
      this.rememberActivitySources([detail]);
      return detail;
    } catch (error) {
      throw toAdminDataError(error, 'Get activity detail');
    }
  }

  async listActivityVersions(activityId: string, options?: GovernanceInput) {
    try {
      const detail = await this.getActivityDetail(activityId, options);
      return readModel(detail.versions, 'live', detail.source_type === 'system' ? undefined : options?.governanceReason);
    } catch (error) {
      throw toAdminDataError(error, 'List activity versions');
    }
  }

  async listRecords(options: RecordListOptions & GovernanceInput) {
    try {
      const governanceReason = requireGovernanceReason(options.governanceReason, 'List family-private records');
      const range = page(options);
      const status = options.moderationStatus && options.moderationStatus !== 'all' ? options.moderationStatus : null;
      const { data, error } = await this.client.rpc('admin_v2_list_family_records', {
        governance_reason: governanceReason,
        p_limit: range.limit,
        p_offset: range.offset,
        p_search: options.search ?? null,
        p_moderation_status: status,
      });
      if (error) throw error;
      return readModel((data ?? []).map(recordFromRpc), 'live', governanceReason);
    } catch (error) {
      throw toAdminDataError(error, 'List family-private records');
    }
  }

  async getRecordDetail(recordId: string, input: GovernanceInput): Promise<RecordDetail> {
    try {
      const governanceReason = requireGovernanceReason(input.governanceReason, 'Get family-private record detail');
      const { data, error } = await this.client.rpc('admin_v2_get_family_record', {
        p_record_id: recordId,
        governance_reason: governanceReason,
      });
      if (error) throw error;
      const row = asRecord(data);
      const media = Array.isArray(row.media) ? row.media.map((item, index) => ({ ...asRecord(item), order_index: index })) : [];
      return {
        ...recordFromRpc(row),
        media: media as RecordDetail['media'],
        governance_metadata: {
          governanceReason,
          moderationCaseId: input.moderationCaseId,
          audit_event_id: asNullableString(row.audit_event_id),
        },
      };
    } catch (error) {
      throw toAdminDataError(error, 'Get family-private record detail');
    }
  }

  async listModerationCases(options: ModerationCaseListOptions = {}): Promise<AdminReadModel<ModerationCase>> {
    const context = 'List moderation cases';
    try {
      await this.assertCurrentCapability('moderation.case.manage', context);
      const governanceReason = requireGovernanceReason(options.governanceReason, context);
      const range = page(options);
      const status = optionalOneOf(options.status, moderationStatusValues, 'status', context);
      const kind = optionalOneOf(options.kind, moderationKindValues, 'kind', context);
      const { data, error } = await this.client.rpc('admin_v2_list_moderation_cases', {
        p_options: {
          governanceReason,
          governance_reason: governanceReason,
          limit: range.limit,
          offset: range.offset,
          search: options.search ?? null,
          status,
          kind,
        },
      });
      if (error) throw error;
      return readModel((data ?? []).map((item) => moderationCaseFromRpc(item, context)), 'live', governanceReason);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async listAuditEvents(options: AuditEventListOptions = {}) {
    try {
      const rows = await this.listAuditLogs(options);
      return readModel(
        rows.map((row) => ({
          id: String(row.id),
          actor_id: row.adminUserId,
          actor_role: 'system_admin' as const,
          action: row.action as AuditEvent['action'],
          target_type: row.targetType as AuditEvent['target_type'],
          target_id: row.targetId,
          family_id: typeof row.details.family_id === 'string' ? row.details.family_id : null,
          reason: typeof row.details.reason === 'string' ? row.details.reason : null,
          metadata: row.details,
          created_at: row.createdAt,
        })),
      );
    } catch (error) {
      throw toAdminDataError(error, 'List audit events');
    }
  }

  async createActivityDraft(input: CreateActivityDraftCommand): Promise<ActivityDetail> {
    const context = 'Create activity draft';
    try {
      await this.assertCurrentCapability('activity.draft.create', context);
      const sourceType = requireOneOf(input.sourceType, sourceTypeValues, 'sourceType', context);
      const governanceReason = requireGovernanceReason(input.governanceReason, context);
      const familyId = sourceType === 'family' ? requireUuid(input.familyId, 'familyId', context) : optionalUuid(input.familyId, 'familyId', context);
      if (sourceType === 'system' && familyId) invalidInput(context, 'familyId is only allowed for family activity drafts.', { field: 'familyId' });
      const title = requireText(input.title, 'title', context, { max: 160 });
      const why = requireText(input.why, 'why', context, { max: 2000 });
      const how = requireText(input.how, 'how', context, { max: 4000 });
      const recordHint = requireText(input.recordHint, 'recordHint', context, { max: 2000 });
      const allowedCaptureModes = requireCaptureModes(input.allowedCaptureModes, context);
      const suggestMode = input.suggestMode ? requireOneOf(input.suggestMode, captureModeValues, 'suggestMode', context) : allowedCaptureModes[0];
      if (!allowedCaptureModes.includes(suggestMode)) {
        invalidInput(context, 'suggestMode must be included in allowedCaptureModes.', { field: 'suggestMode' });
      }

      const { data, error } = await this.client.rpc('admin_v2_create_activity_draft', {
        p_input: {
          sourceType,
          source_type: sourceType,
          familyId,
          family_id: familyId,
          title,
          why,
          how,
          recordHint,
          record_hint: recordHint,
          allowedCaptureModes,
          allowed_capture_modes: allowedCaptureModes,
          suggestMode,
          suggest_mode: suggestMode,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityDetailFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async updateActivityDraft(input: UpdateActivityDraftCommand): Promise<ActivityDetail> {
    const context = 'Update activity draft';
    try {
      await this.assertCurrentCapability('activity.draft.update', context);
      const activityId = requireUuid(input.activityId, 'activityId', context);
      const versionId = requireUuid(input.versionId, 'versionId', context);
      const governanceReason = requireGovernanceReason(input.governanceReason, context);
      const patch = activityVersionPatch(input.patch, context);
      const { data, error } = await this.client.rpc('admin_v2_update_activity_draft', {
        p_input: {
          activityId,
          activity_id: activityId,
          versionId,
          version_id: versionId,
          patch,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityDetailFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async copySystemActivityToFamily(input: CopySystemActivityToFamilyCommand): Promise<ActivityDetail> {
    const context = 'Copy system activity to family';
    try {
      await this.assertCurrentCapability('activity.copy_to_family', context);
      const governanceReason = requireGovernanceReason(input.governanceReason, context);
      const activityId = requireUuid(input.activityId, 'activityId', context);
      const versionId = optionalUuid(input.activityVersionId, 'activityVersionId', context);
      const familyId = requireUuid(input.familyId, 'familyId', context);
      const { data, error } = await this.client.rpc('admin_v2_copy_system_activity_to_family', {
        p_input: {
          activityId,
          activity_id: activityId,
          activityVersionId: versionId,
          activity_version_id: versionId,
          familyId,
          family_id: familyId,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityDetailFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async createActivityVersion(input: CreateActivityVersionCommand): Promise<ActivityVersion> {
    const context = 'Create activity version';
    try {
      await this.assertCurrentCapability('activity.draft.create', context);
      const activityId = requireUuid(input.activity_id, 'activity_id', context);
      const { activity_id: _activityId, governanceReason: _governanceReason, reason: _reason, ...patchInput } = input;
      const governanceReason = governanceReasonFromCommand(input, context);
      const patch = activityVersionPatch(patchInput, context, { allowEmpty: true });
      const { data, error } = await this.client.rpc('admin_v2_create_activity_version', {
        p_input: {
          activityId,
          activity_id: activityId,
          ...asRecord(patch),
          patch,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityVersionFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async approveActivityVersionReview(input: ActivityVersionCommand): Promise<ActivityVersion> {
    const context = 'Approve activity version review';
    try {
      await this.assertCurrentCapability('activity.review.approve', context);
      const governanceReason = governanceReasonFromCommand(input, context);
      const activityId = requireUuid(input.activityId, 'activityId', context);
      const versionId = requireUuid(input.versionId, 'versionId', context);
      const { data, error } = await this.client.rpc('admin_v2_approve_activity_version', {
        p_input: {
          activityId,
          activity_id: activityId,
          versionId,
          version_id: versionId,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityVersionFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async publishActivityVersion(input: ActivityVersionCommand): Promise<ActivityVersion> {
    const context = 'Publish activity version';
    try {
      await this.assertCurrentCapability('activity.version.publish', context);
      const governanceReason = governanceReasonFromCommand(input, context);
      const activityId = requireUuid(input.activityId, 'activityId', context);
      const versionId = requireUuid(input.versionId, 'versionId', context);
      const { data, error } = await this.client.rpc('admin_v2_publish_activity_version', {
        p_input: {
          activityId,
          activity_id: activityId,
          versionId,
          version_id: versionId,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityVersionFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async unpublishActivityVersion(input: ActivityVersionCommand): Promise<ActivityVersion> {
    const context = 'Unpublish activity version';
    try {
      await this.assertCurrentCapability('activity.version.unpublish', context);
      const governanceReason = governanceReasonFromCommand(input, context);
      const activityId = requireUuid(input.activityId, 'activityId', context);
      const versionId = requireUuid(input.versionId, 'versionId', context);
      const { data, error } = await this.client.rpc('admin_v2_unpublish_activity_version', {
        p_input: {
          activityId,
          activity_id: activityId,
          versionId,
          version_id: versionId,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityVersionFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async archiveActivityVersion(input: ActivityVersionCommand): Promise<ActivityVersion> {
    const context = 'Archive activity version';
    try {
      await this.assertCurrentCapability('activity.version.archive', context);
      const governanceReason = governanceReasonFromCommand(input, context);
      const activityId = requireUuid(input.activityId, 'activityId', context);
      const versionId = requireUuid(input.versionId, 'versionId', context);
      const { data, error } = await this.client.rpc('admin_v2_archive_activity_version', {
        p_input: {
          activityId,
          activity_id: activityId,
          versionId,
          version_id: versionId,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return activityVersionFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async requestGovernedPrivateAccess(input: GovernanceInput & { targetType: AuditEvent['target_type']; targetId: string }) {
    const governanceReason = requireGovernanceReason(input.governanceReason, 'Request governed private access');
    return this.writeAuditEvent({
      action: 'view_private',
      target_type: input.targetType,
      target_id: input.targetId,
      reason: governanceReason,
      metadata: { moderation_case_id: input.moderationCaseId ?? null },
    });
  }

  async createModerationCase(input: CreateModerationCaseCommand): Promise<ModerationCase> {
    const context = 'Create moderation case';
    try {
      await this.assertCurrentCapability('moderation.case.manage', context);
      const reason = requireGovernanceReason(input.reason, context);
      const kind = requireOneOf(input.kind, moderationKindValues, 'kind', context);
      const targetType = requireOneOf(input.targetType, moderationTargetValues, 'targetType', context);
      const targetId = requireText(input.targetId, 'targetId', context, { max: 160 });
      const familyId = optionalUuid(input.familyId, 'familyId', context);
      const assignedTo = optionalUuid(input.assignedTo, 'assignedTo', context);
      const { data, error } = await this.client.rpc('admin_v2_create_moderation_case', {
        p_input: {
          kind,
          targetType,
          target_type: targetType,
          targetId,
          target_id: targetId,
          familyId,
          family_id: familyId,
          reason,
          governanceReason: reason,
          governance_reason: reason,
          assignedTo,
          assigned_to: assignedTo,
        },
      });
      if (error) throw error;
      return moderationCaseFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async resolveModerationCase(input: ResolveModerationCaseCommand): Promise<ModerationCase> {
    const context = 'Resolve moderation case';
    try {
      await this.assertCurrentCapability('moderation.case.manage', context);
      const governanceReason = requireGovernanceReason(input.governanceReason ?? input.resolutionNote, context);
      const caseId = requireUuid(input.caseId, 'caseId', context);
      const status = requireOneOf(input.status, ['resolved', 'rejected', 'closed'] as const, 'status', context);
      const resolutionNote = requireText(input.resolutionNote, 'resolutionNote', context, { min: 8, max: 4000 });
      const { data, error } = await this.client.rpc('admin_v2_resolve_moderation_case', {
        p_input: {
          caseId,
          case_id: caseId,
          status,
          resolutionNote,
          resolution_note: resolutionNote,
          governanceReason,
          governance_reason: governanceReason,
          reason: governanceReason,
        },
      });
      if (error) throw error;
      return moderationCaseFromRpc(firstRpcRow(data), context);
    } catch (error) {
      throw toAdminDataError(error, context);
    }
  }

  async writeAuditEvent(input: Omit<AuditEvent, 'id' | 'actor_id' | 'actor_role' | 'created_at'>) {
    try {
      const role = normalizeAdminRole(await requireAdminRole(this.client));
      const { data, error } = await this.client.rpc('admin_v2_write_audit_event', {
        p_action: input.action,
        p_target_type: input.target_type,
        p_target_id: input.target_id,
        p_reason: input.reason ?? null,
        p_metadata: (input.metadata ?? {}) as Json,
      });
      if (error) throw error;
      const row = asRecord(data);
      return {
        id: asString(row.id),
        actor_id: asString(row.actor_id),
        actor_role: role,
        action: input.action,
        target_type: input.target_type,
        target_id: input.target_id,
        family_id: asNullableString(row.family_id ?? input.family_id),
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
        created_at: asString(row.created_at, now()),
      };
    } catch (error) {
      throw toAdminDataError(error, 'Write audit event');
    }
  }

  async listUsers(options: ListOptions = {}) {
    try {
      const range = page(options);
      let query = this.client.from('profiles').select('*').order('created_at', { ascending: false }).range(range.from, range.to);
      if (options.search) {
        query = query.or(`username.ilike.%${options.search}%,generated_email.ilike.%${options.search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        username: row.username,
        generatedEmail: row.generated_email,
        role: row.role,
        customRole: row.custom_role,
        adminRole: row.admin_role,
        createdAt: row.created_at,
      }));
    } catch (error) {
      throw toAdminDataError(error, 'List users');
    }
  }

  async listFamilies(options: ListOptions = {}) {
    try {
      const governanceReason = requireGovernanceReason(options.governanceReason, 'List families');
      const range = page(options);
      const { data, error } = await this.client.rpc('admin_v2_list_families', {
        governance_reason: governanceReason,
        p_limit: range.limit,
        p_offset: range.offset,
        p_search: options.search ?? null,
      });
      if (error) throw error;
      return (data ?? []).map(familyFromRpc);
    } catch (error) {
      throw toAdminDataError(error, 'List families');
    }
  }

  async listMemories(options: ListOptions = {}) {
    const records = await this.listRecords({ ...options, governanceReason: requireGovernanceReason(options.governanceReason, 'List memories') });
    return records.items.map(memoryFromRecord);
  }

  async listContentReview(status?: ModerationStatus, options: ListOptions = {}) {
    const records = await this.listRecords({
      ...options,
      governanceReason: requireGovernanceReason(options.governanceReason, 'List content review records'),
      moderationStatus: status ?? 'all',
    });
    return records.items.map(memoryFromRecord);
  }

  async listNotifications(options: ListOptions = {}) {
    try {
      const governanceReason = requireGovernanceReason(options.governanceReason, 'List notifications');
      const range = page(options);
      const { data, error } = await this.client.rpc('admin_v2_list_notifications', {
        governance_reason: governanceReason,
        p_limit: range.limit,
        p_offset: range.offset,
        p_search: options.search ?? null,
      });
      if (error) throw error;
      return (data ?? []).map(mapNotification);
    } catch (error) {
      throw toAdminDataError(error, 'List notifications');
    }
  }

  async listAuditLogs(options: ListOptions = {}) {
    try {
      const range = page(options);
      const { data, error } = await this.client
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(range.from, range.to);
      if (error) throw error;
      return (data ?? []).map(mapAuditLog);
    } catch (error) {
      throw toAdminDataError(error, 'List audit logs');
    }
  }

  async updateMemoryModeration(id: string, input: { status: ModerationStatus; note?: string; governanceReason?: string }) {
    try {
      await this.assertCurrentCapability('record.moderate', 'Update record moderation');
      const governanceReason = requireGovernanceReason(input.governanceReason, 'Update memory moderation');
      const { data, error } = await this.client.rpc('admin_v2_update_record_moderation', {
        p_record_id: id,
        p_status: input.status,
        p_note: input.note ?? null,
        governance_reason: governanceReason,
      });
      if (error) throw error;
      return memoryFromRecord(recordFromRpc(data));
    } catch (error) {
      throw toAdminDataError(error, 'Update memory moderation');
    }
  }

  async updateNotificationPreferences(
    familyId: string,
    input: Database['public']['Tables']['notification_preferences']['Update'] & { governanceReason?: string },
  ) {
    try {
      const governanceReason = requireGovernanceReason(input.governanceReason, 'Update notification preferences');
      const { governanceReason: _governanceReason, ...patch } = input;
      const { error } = await this.client.rpc('admin_v2_update_notification_preferences', {
        p_family_id: familyId,
        p_patch: patch as Json,
        governance_reason: governanceReason,
      });
      if (error) throw error;
      await this.writeAuditLog({
        action: 'notification_preferences.update',
        target_type: 'family',
        target_id: familyId,
        details: { ...patch, reason: governanceReason },
      });
    } catch (error) {
      throw toAdminDataError(error, 'Update notification preferences');
    }
  }

  async writeAuditLog(input: Omit<Database['public']['Tables']['admin_audit_log']['Insert'], 'admin_user_id'>) {
    try {
      const adminUserId = (await requireAdminUser(this.client)).id;
      const { error } = await this.client.from('admin_audit_log').insert({
        admin_user_id: adminUserId,
        action: input.action,
        target_type: input.target_type,
        target_id: input.target_id,
        details: input.details ?? {},
        ip_address: input.ip_address ?? null,
      });
      if (error) throw error;
    } catch (error) {
      throw toAdminDataError(error, 'Write admin audit log');
    }
  }

  private async assertCurrentCapability(capability: Parameters<typeof assertCapability>[1], context: string) {
    const role = await requireAdminRole(this.client);
    assertCapability(role, capability, context);
  }

  private rememberActivitySources(items: Array<Pick<ActivityListItem, 'id' | 'source_type'>>) {
    for (const item of items) {
      this.activitySourceById.set(item.id, item.source_type);
    }
  }
}
