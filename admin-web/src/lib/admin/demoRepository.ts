import { AdminDataError } from './errors';
import { getCapabilities } from './permissions';
import type {
  ActivityDetail,
  ActivityListItem,
  ActivityListOptions,
  ActivityVersion,
  AdminReadModel,
  AdminRepository,
  AuditEvent,
  AuditEventListOptions,
  AuditLogRow,
  DashboardSummary,
  FamilyRow,
  GovernanceInput,
  ListOptions,
  MemoryRow,
  ModerationCase,
  ModerationCaseListOptions,
  ModerationStatus,
  NotificationRow,
  RecordDetail,
  RecordListItem,
  RecordListOptions,
} from './types';

const generatedAt = '2026-07-28T00:00:00.000Z';

const demoVersion: ActivityVersion = {
  id: 'demo-system-activity-001-v1',
  activity_id: 'demo-system-activity-001',
  version_no: 1,
  status: 'published',
  title: '[DEMO] Build a rainy-day memory jar',
  why: 'Demo copy only. This is not production content.',
  how: 'Write a short note together and decorate the jar.',
  record_hint: 'Record a photo and a short caption.',
  suggest_mode: 'photo',
  allowed_capture_modes: ['text', 'photo', 'video', 'voice'],
  illustration: {
    source: 'system_asset',
    path: 'demo/system/jar.png',
    storage_bucket: 'illustrations',
    storage_path: 'demo/system/jar.png',
    mime_type: 'image/png',
    width: 1200,
    height: 800,
    alt: '[DEMO] Memory jar illustration',
    metadata: { source: 'demo' },
  },
  perspective: 'together',
  tone: 'demo',
  category: 'demo',
  scene: 'home',
  tags: ['demo'],
  seasonal: false,
  created_at: generatedAt,
  updated_at: generatedAt,
  published_at: generatedAt,
  published_by: 'demo-admin-user',
};

const activities: ActivityListItem[] = [
  {
    id: 'demo-system-activity-001',
    source_type: 'system',
    source_key: 'DEMO-001',
    display_no: 'DEMO-001',
    family_id: null,
    created_by: 'demo-admin-user',
    created_at: generatedAt,
    updated_at: generatedAt,
    current_version_id: demoVersion.id,
    status: 'published',
    visibility: 'system',
    copied_from: null,
    current_version: demoVersion,
    read_model_source: 'activities_v2',
  },
];

const users = [
  {
    id: 'demo-admin-user',
    username: 'demo-admin',
    generatedEmail: 'demo-admin@example.invalid',
    role: '爸爸',
    customRole: '',
    adminRole: 'system_admin' as const,
    createdAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'demo-parent-user',
    username: 'demo-parent',
    generatedEmail: 'demo-parent@example.invalid',
    role: '妈妈',
    customRole: '',
    adminRole: null,
    createdAt: '2026-07-02T10:00:00.000Z',
  },
];

const families: FamilyRow[] = [
  {
    id: 'demo-family-1',
    createdBy: 'demo-parent-user',
    inviteCode: 'DEMO2026',
    createdAt: '2026-07-02T10:10:00.000Z',
    memberCount: 2,
    kidCount: 1,
    memoryCount: 2,
    readStatus: 'demo',
  },
];

const records: RecordListItem[] = [
  {
    id: 'demo-record-pending',
    family_id: 'demo-family-1',
    kid_id: 'demo-kid-1',
    activity_id: 'demo-system-activity-001',
    activity_version_id: demoVersion.id,
    recorded_by: 'demo-parent-user',
    primary_capture_mode: 'photo',
    capture_modes: ['photo', 'text'],
    title: '[DEMO] Family record awaiting review',
    caption: 'Demo private record. Requires governance reason in live mode.',
    transcript: null,
    duration: null,
    shots: 2,
    place: 'Demo home',
    recorded_at: '2026-07-20T08:00:00.000Z',
    sealed: 'unsealed',
    seal_until: null,
    seal_label: null,
    moderation_status: 'pending',
    moderation_note: '',
    snapshot: {
      activity_title: demoVersion.title,
      activity_why: demoVersion.why,
      activity_how: demoVersion.how,
      record_hint: demoVersion.record_hint,
      suggest_mode: demoVersion.suggest_mode,
      allowed_capture_modes: demoVersion.allowed_capture_modes,
      illustration_source: 'system_asset',
    },
    created_at: '2026-07-20T08:00:00.000Z',
    updated_at: '2026-07-20T08:00:00.000Z',
    media_count: 2,
    media_kinds: ['image', 'text'],
    read_model_source: 'activity_records_v2',
  },
];

const notifications: NotificationRow[] = [
  {
    id: 1,
    event: 'demo.memory_created',
    familyId: 'demo-family-1',
    kidId: 'demo-kid-1',
    status: 'pending',
    attempts: 0,
    maxAttempts: 6,
    sentCount: null,
    lastError: null,
    createdAt: '2026-07-20T08:00:10.000Z',
    processedAt: null,
  },
];

const auditLogs: AuditLogRow[] = [
  {
    id: 1,
    adminUserId: 'demo-admin-user',
    action: 'demo.repository.selected',
    targetType: 'repository',
    targetId: 'demo',
    details: { source: 'demo', warning: 'Explicit demo repository. No production data.' },
    ipAddress: null,
    createdAt: generatedAt,
  },
];

function readModel<T>(items: T[], governanceReason?: string): AdminReadModel<T> {
  return {
    status: 'demo',
    source: 'demo',
    generatedAt,
    items,
    governanceReason,
  };
}

function requireDemoReason(input?: GovernanceInput | ListOptions) {
  return input?.governanceReason?.trim() || '[DEMO] explicit demo repository access';
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
    moderationStatus: record.moderation_status === 'hidden' ? 'removed' : record.moderation_status === 'rejected' ? 'flagged' : record.moderation_status ?? 'pending',
    moderationNote: record.moderation_note ?? '',
    createdAt: record.created_at,
    readStatus: 'demo',
  };
}

function demoReadonly(operation: string): never {
  throw new AdminDataError(`${operation}: explicit demo repository is read-only for V2 production commands.`, 'demo_repository_readonly', undefined, {
    source: 'demo',
  });
}

export function createDemoAdminRepository(reason = 'Explicit demo admin repository selected.'): AdminRepository {
  return {
    mode: 'demo',
    reason,
    async getPermissionSummary(role = 'system_admin') {
      return getCapabilities(role);
    },
    async getDashboardSummary(): Promise<DashboardSummary> {
      return {
        source: 'demo',
        generatedAt,
        totals: {
          users: users.length,
          families: families.length,
          kids: 1,
          memories: records.length,
          pendingReview: records.filter((record) => record.moderation_status === 'pending').length,
          notificationQueue: notifications.filter((notification) => notification.status !== 'done').length,
          systemActivities: activities.length,
          familyActivities: 0,
          publishedVersions: 1,
          moderationCases: 1,
          auditEvents: auditLogs.length,
        },
        daily: [
          { day: '2026-07-18', newUsers: 1, newMemories: 0, activeFamilies: 1 },
          { day: '2026-07-20', newUsers: 0, newMemories: 1, activeFamilies: 1 },
        ],
      };
    },
    async listActivities(options?: ActivityListOptions) {
      const filtered = options?.sourceType && options.sourceType !== 'all' ? activities.filter((item) => item.source_type === options.sourceType) : activities;
      return readModel(filtered);
    },
    async getActivityDetail(activityId: string): Promise<ActivityDetail> {
      const activity = activities.find((item) => item.id === activityId);
      if (!activity) throw new AdminDataError(`Demo activity not found: ${activityId}`, 'admin_query_failed');
      return {
        ...activity,
        versions: activity.current_version ? [activity.current_version] : [],
        audit_metadata: { read_model_source: 'activities_v2', compatibility_note: 'Explicit demo object.' },
      };
    },
    async listActivityVersions(activityId: string) {
      const detail = await this.getActivityDetail(activityId);
      return readModel(detail.versions);
    },
    async listRecords(options: RecordListOptions & GovernanceInput) {
      return readModel(records, requireDemoReason(options));
    },
    async getRecordDetail(recordId: string, input: GovernanceInput): Promise<RecordDetail> {
      const record = records.find((item) => item.id === recordId);
      if (!record) throw new AdminDataError(`Demo record not found: ${recordId}`, 'admin_query_failed');
      return {
        ...record,
        media: [
          {
            id: 'demo-record-media-1',
            record_id: record.id,
            kind: 'image',
            storage_path: 'demo/family/record/photo.png',
            mime_type: 'image/png',
            order_index: 0,
            is_primary: true,
            caption: '[DEMO] private media placeholder',
            created_at: record.created_at,
          },
        ],
        governance_metadata: {
          governanceReason: requireDemoReason(input),
          moderationCaseId: input.moderationCaseId,
          audit_event_id: 'demo-audit-view-private',
        },
      };
    },
    async listModerationCases(_options?: ModerationCaseListOptions): Promise<AdminReadModel<ModerationCase>> {
      return readModel([
        {
          id: 'demo-case-record-review',
          kind: 'record_review',
          status: 'open',
          reason: '[DEMO] pending private record review',
          target_type: 'record',
          target_id: 'demo-record-pending',
          family_id: 'demo-family-1',
          opened_by: 'demo-system',
          opened_at: generatedAt,
        },
      ]);
    },
    async listAuditEvents(_options?: AuditEventListOptions): Promise<AdminReadModel<AuditEvent>> {
      return readModel(
        auditLogs.map((row) => ({
          id: String(row.id),
          actor_id: row.adminUserId,
          actor_role: 'system_admin',
          action: row.action as AuditEvent['action'],
          target_type: row.targetType as AuditEvent['target_type'],
          target_id: row.targetId,
          reason: '[DEMO] audit event',
          metadata: row.details,
          created_at: row.createdAt,
        })),
      );
    },
    async createActivityDraft() {
      return demoReadonly('createActivityDraft');
    },
    async updateActivityDraft() {
      return demoReadonly('updateActivityDraft');
    },
    async copySystemActivityToFamily() {
      return demoReadonly('copySystemActivityToFamily');
    },
    async createActivityVersion() {
      return demoReadonly('createActivityVersion');
    },
    async approveActivityVersionReview() {
      return demoReadonly('approveActivityVersionReview');
    },
    async publishActivityVersion() {
      return demoReadonly('publishActivityVersion');
    },
    async unpublishActivityVersion() {
      return demoReadonly('unpublishActivityVersion');
    },
    async archiveActivityVersion() {
      return demoReadonly('archiveActivityVersion');
    },
    async requestGovernedPrivateAccess(input) {
      return {
        id: 'demo-audit-view-private',
        actor_id: 'demo-admin-user',
        actor_role: 'system_admin',
        action: 'view_private',
        target_type: input.targetType,
        target_id: input.targetId,
        reason: requireDemoReason(input),
        metadata: { source: 'demo', moderation_case_id: input.moderationCaseId ?? null },
        created_at: generatedAt,
      };
    },
    async createModerationCase() {
      return demoReadonly('createModerationCase');
    },
    async resolveModerationCase() {
      return demoReadonly('resolveModerationCase');
    },
    async writeAuditEvent(input) {
      return {
        id: `demo-audit-${auditLogs.length + 1}`,
        actor_id: 'demo-admin-user',
        actor_role: 'system_admin',
        action: input.action,
        target_type: input.target_type,
        target_id: input.target_id,
        family_id: input.family_id,
        reason: input.reason ?? '[DEMO] audit event',
        metadata: { ...(input.metadata ?? {}), source: 'demo' },
        created_at: generatedAt,
      };
    },
    async listUsers() {
      return users;
    },
    async listFamilies() {
      return families;
    },
    async listMemories() {
      return records.map(memoryFromRecord);
    },
    async listContentReview(status?: ModerationStatus) {
      const memories = records.map(memoryFromRecord);
      return status ? memories.filter((memory) => memory.moderationStatus === status) : memories;
    },
    async listNotifications() {
      return notifications;
    },
    async listAuditLogs() {
      return auditLogs;
    },
    async updateMemoryModeration(id, input) {
      const record = records.find((item) => item.id === id);
      if (!record) throw new AdminDataError(`Demo record not found: ${id}`, 'admin_query_failed');
      record.moderation_status = input.status === 'removed' ? 'hidden' : input.status === 'flagged' ? 'rejected' : input.status;
      record.moderation_note = `[DEMO] ${input.note ?? ''}`.trim();
      record.updated_at = generatedAt;
      return memoryFromRecord(record);
    },
    async updateNotificationPreferences() {
      return demoReadonly('updateNotificationPreferences');
    },
    async writeAuditLog(input) {
      auditLogs.unshift({
        id: auditLogs.length + 1,
        adminUserId: 'demo-admin-user',
        action: `demo.${input.action}`,
        targetType: input.target_type,
        targetId: input.target_id,
        details: { ...(input.details ?? {}), source: 'demo' },
        ipAddress: null,
        createdAt: generatedAt,
      });
    },
  };
}
