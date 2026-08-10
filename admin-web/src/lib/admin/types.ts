import type { SupabaseClient, User } from '@supabase/supabase-js';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AdminRoleV2 = 'content_editor' | 'content_reviewer' | 'family_support' | 'system_admin';
export type LegacyAdminRole = 'super_admin' | 'admin' | 'operator' | 'support';
export type AdminRole = AdminRoleV2 | LegacyAdminRole;

export type AdminCapability =
  | 'activity.draft.create'
  | 'activity.draft.update'
  | 'activity.review.approve'
  | 'activity.version.publish'
  | 'activity.version.unpublish'
  | 'activity.version.archive'
  | 'activity.copy_to_family'
  | 'moderation.case.manage'
  | 'record.view_governed'
  | 'record.moderate'
  | 'family.support'
  | 'audit.view'
  | 'audit.write';

export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'removed';
export type NotificationOutboxStatus = 'pending' | 'processing' | 'done' | 'dead';

export type CaptureMode = 'text' | 'photo' | 'video' | 'voice';
export type SuggestMode = CaptureMode;
export type ActivitySourceType = 'system' | 'family' | 'copied_family';
export type ActivityLifecycleStatus = 'draft' | 'published' | 'archived' | 'unpublished' | 'deleted';
export type ActivityVisibility = 'system' | 'family_private' | 'governed';
export type VersionStatus = 'draft' | 'published' | 'archived' | 'unpublished';
export type IllustrationSource = 'system_asset' | 'family_private' | 'motif_fallback' | 'none';
export type SealRecommendationKind = 'none' | 'until_date' | 'age_based' | 'manual_prompt';
export type RecordModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden';
export type RecordSealState = 'sealed' | 'unsealed';
export type RecordMediaKind = 'image' | 'video' | 'audio' | 'text' | 'other';
export type ModerationCaseKind =
  | 'record_review'
  | 'activity_review'
  | 'asset_review'
  | 'family_support'
  | 'policy_violation'
  | 'public_request';
export type ModerationCaseStatus = 'open' | 'in_review' | 'resolved' | 'rejected' | 'closed';
export type AuditEventAction =
  | 'create'
  | 'update'
  | 'copy'
  | 'approve_review'
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'delete'
  | 'view_private'
  | 'moderate'
  | 'grant_access'
  | 'revoke_access';
export type AuditTargetType = 'activity' | 'activity_version' | 'record' | 'asset' | 'family' | 'member' | 'moderation_case';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          generated_email: string | null;
          role: string;
          custom_role: string;
          appearance: Json | null;
          family_extras: Json[];
          created_at: string;
          admin_role: AdminRole | null;
        };
        Update: {
          admin_role?: AdminRole | null;
          username?: string | null;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      families: {
        Row: {
          id: string;
          created_by: string;
          invite_code: string;
          created_at: string;
        };
        Update: {
          invite_code?: string;
        };
        Insert: Partial<Database['public']['Tables']['families']['Row']>;
        Relationships: [];
      };
      family_members: {
        Row: {
          family_id: string;
          user_id: string;
          role: string;
          custom_role: string;
          joined_at: string;
        };
        Insert: Partial<Database['public']['Tables']['family_members']['Row']>;
        Update: Partial<Database['public']['Tables']['family_members']['Row']>;
        Relationships: [];
      };
      kids: {
        Row: {
          id: string;
          family_id: string;
          user_id: string | null;
          name: string;
          birth_year: number;
          birth_month: number;
          tone: string;
          bear: string;
          since: string;
          accessories: string[];
        };
        Insert: Partial<Database['public']['Tables']['kids']['Row']>;
        Update: Partial<Database['public']['Tables']['kids']['Row']>;
        Relationships: [];
      };
      levels: {
        Row: {
          num: string;
          perspective: 'parent' | 'child' | 'together';
          tone: string;
          title: string;
          why: string;
          how: string;
          record: string;
          suggest: 'voice' | 'photo' | 'text' | 'video';
          sealed: boolean;
          seal_until: string | null;
          sealed_on: string | null;
          seal_kind: 'age18' | 'date' | string;
          seasonal: boolean;
          kid: string | null;
          sort_order: number;
          illustration_path: string | null;
          active?: boolean | null;
          category?: string | null;
          scene?: string | null;
          min_age?: number | null;
          max_age?: number | null;
          seasons?: string[] | null;
          tags?: string[] | null;
          quality_score?: number | null;
        };
        Insert: Partial<Database['public']['Tables']['levels']['Row']>;
        Update: Partial<Database['public']['Tables']['levels']['Row']>;
        Relationships: [];
      };
      custom_levels: {
        Row: {
          id: number;
          family_id: string;
          user_id: string | null;
          num: string;
          title: string;
          why: string;
          how: string;
          record_hint: string;
          perspective: 'parent' | 'child' | 'together';
          tone: string;
          suggest: 'voice' | 'photo' | 'text' | 'video';
          illustration_path: string | null;
          recurring: string | null;
          spot_note: string;
          reminder_text: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['custom_levels']['Row']>;
        Update: Partial<Database['public']['Tables']['custom_levels']['Row']>;
        Relationships: [];
      };
      memories: {
        Row: {
          id: string;
          family_id: string;
          user_id: string | null;
          kid_id: string;
          level_num: string;
          perspective: string;
          type: 'voice' | 'photo' | 'text' | 'video';
          duration: string | null;
          shots: number | null;
          date: string;
          place: string | null;
          title: string;
          caption: string;
          transcript: string | null;
          tone: string;
          sealed: boolean;
          seal_until: string | null;
          seal_label: string | null;
          invite_token_id?: string | null;
          invited_role?: string | null;
          created_at: string;
          moderation_status: ModerationStatus;
          moderation_note: string | null;
        };
        Update: {
          moderation_status?: ModerationStatus;
          moderation_note?: string;
        };
        Insert: Partial<Database['public']['Tables']['memories']['Row']>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          family_id: string;
          enabled: boolean;
          frequency: 'gentle' | 'normal' | 'frequent';
          notify_family?: boolean;
          quiet_start: string;
          quiet_end: string;
          updated_at: string;
        };
        Update: {
          enabled?: boolean;
          frequency?: 'gentle' | 'normal' | 'frequent';
          notify_family?: boolean;
          quiet_start?: string;
          quiet_end?: string;
          updated_at?: string;
        };
        Insert: Partial<Database['public']['Tables']['notification_preferences']['Row']>;
        Relationships: [];
      };
      notification_templates: {
        Row: {
          id: number;
          scene: string;
          species: string;
          lang: string;
          title: string;
          body: string;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notification_templates']['Row']>;
        Update: Partial<Database['public']['Tables']['notification_templates']['Row']>;
        Relationships: [];
      };
      notification_log: {
        Row: {
          id: number;
          kid_id: string;
          family_id: string;
          scene: string;
          template_id: number | null;
          sent_at: string;
          clicked: boolean;
          clicked_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['notification_log']['Row']>;
        Update: Partial<Database['public']['Tables']['notification_log']['Row']>;
        Relationships: [];
      };
      notification_outbox: {
        Row: {
          id: number;
          event: string;
          family_id: string;
          kid_id: string | null;
          actor_user_id: string | null;
          who: string | null;
          dedupe_key: string | null;
          status: NotificationOutboxStatus;
          attempts: number;
          max_attempts: number;
          next_attempt_at: string;
          sent_count: number | null;
          last_error: string | null;
          created_at: string;
          processed_at: string | null;
          payload?: Record<string, unknown> | null;
        };
        Insert: Partial<Database['public']['Tables']['notification_outbox']['Row']>;
        Update: Partial<Database['public']['Tables']['notification_outbox']['Row']>;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: number;
          admin_user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          details: Record<string, unknown>;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          admin_user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          details?: Record<string, unknown>;
          ip_address?: string | null;
        };
        Update: Partial<Database['public']['Tables']['admin_audit_log']['Row']>;
        Relationships: [];
      };
      mv_daily_stats: {
        Row: {
          day: string;
          new_memories: number;
          active_families: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      mv_daily_users: {
        Row: {
          day: string;
          new_users: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_v2_dashboard_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_v2_list_family_activities: {
        Args: { governance_reason: string; p_limit?: number; p_offset?: number; p_search?: string | null };
        Returns: Json[];
      };
      admin_v2_list_system_activities: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string | null };
        Returns: Json[];
      };
      admin_v2_get_family_activity: {
        Args: { p_activity_id: string; governance_reason: string };
        Returns: Json;
      };
      admin_v2_get_system_activity: {
        Args: { p_activity_id: string };
        Returns: Json;
      };
      admin_v2_list_families: {
        Args: { governance_reason: string; p_limit?: number; p_offset?: number; p_search?: string | null };
        Returns: Json[];
      };
      admin_v2_list_family_records: {
        Args: {
          governance_reason: string;
          p_limit?: number;
          p_offset?: number;
          p_search?: string | null;
          p_moderation_status?: string | null;
        };
        Returns: Json[];
      };
      admin_v2_get_family_record: {
        Args: { p_record_id: string; governance_reason: string };
        Returns: Json;
      };
      admin_v2_list_notifications: {
        Args: { governance_reason: string; p_limit?: number; p_offset?: number; p_search?: string | null };
        Returns: Json[];
      };
      admin_v2_update_record_moderation: {
        Args: { p_record_id: string; p_status: string; p_note?: string | null; governance_reason: string };
        Returns: Json;
      };
      admin_v2_update_notification_preferences: {
        Args: { p_family_id: string; p_patch: Json; governance_reason: string };
        Returns: Json;
      };
      admin_v2_list_moderation_cases: {
        Args: { p_options?: Json };
        Returns: Json[];
      };
      admin_v2_create_activity_draft: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_update_activity_draft: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_copy_system_activity_to_family: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_create_activity_version: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_approve_activity_version: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_publish_activity_version: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_unpublish_activity_version: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_archive_activity_version: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_create_moderation_case: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_resolve_moderation_case: {
        Args: { p_input: Json };
        Returns: Json;
      };
      admin_v2_write_audit_event: {
        Args: {
          p_action: string;
          p_target_type: string;
          p_target_id: string;
          p_reason?: string | null;
          p_metadata?: Json;
        };
        Returns: Json;
      };
    };
  };
}

export type AdminSupabaseClient = SupabaseClient<Database>;

export interface AdminSession {
  user: User;
  role: AdminRole;
  profile: Database['public']['Tables']['profiles']['Row'];
}

export interface AdminAuthState {
  session: AdminSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'demo' | 'error';
  error: string | null;
}

export type AdminRepositoryMode = 'live' | 'demo';
export type AdminReadStatus = 'live' | 'demo' | 'permission_denied';

export interface AdminReadModel<T> {
  status: AdminReadStatus;
  source: AdminRepositoryMode;
  generatedAt: string;
  items: T[];
  governanceReason?: string;
  permissionDeniedReason?: string;
}

export interface GovernanceInput {
  governanceReason: string;
  moderationCaseId?: string;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  governanceReason?: string;
  moderationCaseId?: string;
}

export interface ActivityListOptions extends ListOptions {
  sourceType?: ActivitySourceType | 'all';
  status?: ActivityLifecycleStatus | 'all';
}

export interface RecordListOptions extends ListOptions {
  moderationStatus?: RecordModerationStatus | ModerationStatus | 'all';
}

export interface ModerationCaseListOptions extends ListOptions {
  status?: ModerationCaseStatus | 'all';
  kind?: ModerationCaseKind | 'all';
}

export interface AuditEventListOptions extends ListOptions {
  targetType?: AuditTargetType | 'all';
}

export interface Activity {
  id: string;
  source_type: ActivitySourceType;
  source_key: string;
  display_no?: string | null;
  family_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_version_id?: string | null;
  status: ActivityLifecycleStatus;
  visibility: ActivityVisibility;
  copied_from?: {
    activity_id: string;
    activity_version_id?: string | null;
  } | null;
  deleted_at?: string | null;
}

export interface ActivityVersion {
  id: string;
  activity_id: string;
  version_no: number;
  status: VersionStatus;
  title: string;
  why: string;
  how: string;
  record_hint: string;
  suggest_mode: SuggestMode;
  allowed_capture_modes: CaptureMode[];
  illustration?: {
    asset_id?: string | null;
    source: IllustrationSource;
    path?: string | null;
    storage_bucket?: string | null;
    storage_path?: string | null;
    mime_type?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  family_id?: string | null;
  perspective?: 'parent' | 'child' | 'together' | null;
  tone?: string | null;
  category?: string | null;
  scene?: string | null;
  tags?: string[] | null;
  min_age?: number | null;
  max_age?: number | null;
  seasonal?: boolean | null;
  seal_recommendation?: {
    default_state: 'recommend_unsealed' | 'recommend_sealed';
    kind: SealRecommendationKind;
    default_until?: string | null;
    label?: string | null;
    reason?: string | null;
  } | null;
  published_at?: string | null;
  published_by?: string | null;
  drafted_by?: string | null;
  review_approved_at?: string | null;
  review_approved_by?: string | null;
  copied_from_version_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityListItem extends Activity {
  current_version?: ActivityVersion | null;
  read_model_source: 'levels_compat' | 'custom_levels_rpc' | 'activities_v2';
}

export interface ActivityDetail extends Activity {
  current_version?: ActivityVersion | null;
  versions: ActivityVersion[];
  audit_metadata: {
    read_model_source: ActivityListItem['read_model_source'];
    compatibility_note?: string | null;
  };
}

export interface RecordSnapshot {
  activity_title: string;
  activity_why: string;
  activity_how: string;
  record_hint: string;
  suggest_mode: CaptureMode;
  allowed_capture_modes: CaptureMode[];
  illustration_source?: IllustrationSource | null;
}

export interface ActivityRecord {
  id: string;
  family_id: string;
  kid_id: string;
  activity_id: string;
  activity_version_id: string;
  recorded_by: string;
  primary_capture_mode: CaptureMode;
  capture_modes: CaptureMode[];
  title?: string | null;
  caption?: string | null;
  transcript?: string | null;
  duration?: number | string | null;
  shots?: number | null;
  place?: string | null;
  recorded_at: string;
  sealed: RecordSealState;
  seal_until?: string | null;
  seal_label?: string | null;
  moderation_status?: RecordModerationStatus | null;
  moderation_note?: string | null;
  snapshot: RecordSnapshot;
  created_at: string;
  updated_at: string;
}

export interface RecordMedia {
  id: string;
  record_id: string;
  kind: RecordMediaKind;
  storage_path?: string | null;
  mime_type?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  order_index: number;
  is_primary?: boolean | null;
  caption?: string | null;
  created_at: string;
}

export interface RecordListItem extends ActivityRecord {
  media_count?: number;
  media_kinds?: RecordMediaKind[];
  read_model_source: 'governed_rpc' | 'memories_compat_rpc' | 'activity_records_v2';
}

export interface RecordDetail extends RecordListItem {
  media: RecordMedia[];
  governance_metadata: GovernanceInput & {
    audit_event_id?: string | null;
  };
}

export interface ModerationCase {
  id: string;
  kind: ModerationCaseKind;
  status: ModerationCaseStatus;
  reason: string;
  target_type: 'activity' | 'activity_version' | 'record' | 'asset' | 'family';
  target_id: string;
  family_id?: string | null;
  opened_by: string;
  assigned_to?: string | null;
  opened_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
  audit_event_id?: string | null;
}

export interface AuditEvent {
  id: string;
  actor_id: string;
  actor_role: AdminRoleV2;
  action: AuditEventAction;
  target_type: AuditTargetType;
  target_id: string;
  family_id?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface RoleCapabilitySummary {
  role: AdminRole;
  normalizedRole: AdminRoleV2;
  capabilities: AdminCapability[];
}

export interface CreateActivityDraftCommand {
  sourceType: Extract<ActivitySourceType, 'system' | 'family'>;
  familyId?: string | null;
  title: string;
  why: string;
  how: string;
  recordHint: string;
  allowedCaptureModes: CaptureMode[];
  suggestMode?: CaptureMode;
  governanceReason?: string;
}

export interface UpdateActivityDraftCommand {
  activityId: string;
  versionId: string;
  patch: Partial<ActivityVersion>;
  governanceReason?: string;
}

export interface CopySystemActivityToFamilyCommand extends GovernanceInput {
  activityId: string;
  activityVersionId?: string | null;
  familyId: string;
}

export interface ActivityVersionCommand {
  activityId: string;
  versionId: string;
  governanceReason?: string;
  reason?: string;
}

export type CreateActivityVersionCommand = Partial<ActivityVersion> & {
  activity_id: string;
  governanceReason?: string;
  reason?: string;
};

export interface CreateModerationCaseCommand {
  kind: ModerationCaseKind;
  targetType: ModerationCase['target_type'];
  targetId: string;
  reason: string;
  familyId?: string | null;
  assignedTo?: string | null;
}

export interface ResolveModerationCaseCommand {
  caseId: string;
  status: Extract<ModerationCaseStatus, 'resolved' | 'rejected' | 'closed'>;
  resolutionNote: string;
  governanceReason?: string;
}

export interface DashboardSummary {
  source: AdminRepositoryMode;
  generatedAt: string;
  totals: {
    users: number;
    families: number;
    kids: number;
    memories: number;
    pendingReview: number;
    notificationQueue: number;
    systemActivities?: number;
    familyActivities?: number;
    publishedVersions?: number;
    moderationCases?: number;
    auditEvents?: number;
  };
  daily: Array<{
    day: string;
    newUsers: number;
    newMemories: number;
    activeFamilies: number;
  }>;
}

export interface AdminUserRow {
  id: string;
  username: string | null;
  generatedEmail: string | null;
  role: string;
  customRole: string;
  adminRole: AdminRole | null;
  createdAt: string;
}

export interface FamilyRow {
  id: string;
  createdBy: string;
  inviteCode: string;
  createdAt: string;
  memberCount?: number;
  kidCount?: number;
  memoryCount?: number;
  readStatus?: AdminReadStatus;
}

export interface MemoryRow {
  id: string;
  familyId: string;
  userId: string | null;
  kidId: string;
  levelNum: string;
  perspective: string;
  type: 'voice' | 'photo' | 'text' | 'video';
  title: string;
  caption: string;
  transcript: string | null;
  sealed: boolean;
  moderationStatus: ModerationStatus;
  moderationNote: string;
  createdAt: string;
  readStatus?: AdminReadStatus;
}

export interface NotificationRow {
  id: number;
  event: string;
  familyId: string;
  kidId: string | null;
  status: NotificationOutboxStatus;
  attempts: number;
  maxAttempts: number;
  sentCount: number | null;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface AuditLogRow {
  id: number;
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminRepository {
  readonly mode: AdminRepositoryMode;
  readonly reason?: string;
  getPermissionSummary(role?: AdminRole): Promise<RoleCapabilitySummary>;
  getDashboardSummary(): Promise<DashboardSummary>;
  listActivities(options?: ActivityListOptions): Promise<AdminReadModel<ActivityListItem>>;
  getActivityDetail(activityId: string, options?: GovernanceInput): Promise<ActivityDetail>;
  listActivityVersions(activityId: string, options?: GovernanceInput): Promise<AdminReadModel<ActivityVersion>>;
  listRecords(options: RecordListOptions & GovernanceInput): Promise<AdminReadModel<RecordListItem>>;
  getRecordDetail(recordId: string, input: GovernanceInput): Promise<RecordDetail>;
  listModerationCases(options?: ModerationCaseListOptions): Promise<AdminReadModel<ModerationCase>>;
  listAuditEvents(options?: AuditEventListOptions): Promise<AdminReadModel<AuditEvent>>;
  createActivityDraft(input: CreateActivityDraftCommand): Promise<ActivityDetail>;
  updateActivityDraft(input: UpdateActivityDraftCommand): Promise<ActivityDetail>;
  copySystemActivityToFamily(input: CopySystemActivityToFamilyCommand): Promise<ActivityDetail>;
  createActivityVersion(input: CreateActivityVersionCommand): Promise<ActivityVersion>;
  approveActivityVersionReview(input: ActivityVersionCommand): Promise<ActivityVersion>;
  publishActivityVersion(input: ActivityVersionCommand): Promise<ActivityVersion>;
  unpublishActivityVersion(input: ActivityVersionCommand): Promise<ActivityVersion>;
  archiveActivityVersion(input: ActivityVersionCommand): Promise<ActivityVersion>;
  requestGovernedPrivateAccess(input: GovernanceInput & { targetType: AuditTargetType; targetId: string }): Promise<AuditEvent>;
  createModerationCase(input: CreateModerationCaseCommand): Promise<ModerationCase>;
  resolveModerationCase(input: ResolveModerationCaseCommand): Promise<ModerationCase>;
  writeAuditEvent(input: Omit<AuditEvent, 'id' | 'actor_id' | 'actor_role' | 'created_at'>): Promise<AuditEvent>;

  listUsers(options?: ListOptions): Promise<AdminUserRow[]>;
  listFamilies(options?: ListOptions): Promise<FamilyRow[]>;
  listMemories(options?: ListOptions): Promise<MemoryRow[]>;
  listContentReview(status?: ModerationStatus, options?: ListOptions): Promise<MemoryRow[]>;
  listNotifications(options?: ListOptions): Promise<NotificationRow[]>;
  listAuditLogs(options?: ListOptions): Promise<AuditLogRow[]>;
  updateMemoryModeration(
    id: string,
    input: { status: ModerationStatus; note?: string; governanceReason?: string },
  ): Promise<MemoryRow>;
  updateNotificationPreferences(
    familyId: string,
    input: Database['public']['Tables']['notification_preferences']['Update'] & { governanceReason?: string },
  ): Promise<void>;
  writeAuditLog(input: Omit<Database['public']['Tables']['admin_audit_log']['Insert'], 'admin_user_id'>): Promise<void>;
}
