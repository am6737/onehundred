export type AdminRole = 'super_admin' | 'admin' | 'operator' | 'support';

export interface Profile {
  id: string;
  username: string | null;
  generated_email: string | null;
  role: string;
  custom_role: string;
  appearance: Record<string, unknown> | null;
  family_extras: unknown[];
  admin_role: AdminRole | null;
  created_at: string;
}

export interface Family {
  id: string;
  created_by: string;
  invite_code: string;
  created_at: string;
}

export interface FamilyMember {
  family_id: string;
  user_id: string;
  role: string;
  custom_role: string;
  joined_at: string;
}

export interface Kid {
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
}

export interface Memory {
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
  invite_token_id: string | null;
  invited_role: string | null;
  moderation_status: 'pending' | 'approved' | 'flagged' | 'removed';
  moderation_note: string;
  created_at: string;
}

export interface Mascot {
  kid_id: string;
  family_id: string;
  name: string;
  tone: string;
  since: string;
  stage: number;
  grown: number;
  items: unknown[];
  log: unknown[];
  species: 'bear' | 'dog' | 'cat';
}

export interface Level {
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
  seal_kind: 'age18' | 'date';
  seasonal: boolean;
  kid: string | null;
  sort_order: number;
  illustration_path: string | null;
}

export interface CustomLevel {
  id: number;
  family_id: string;
  user_id: string | null;
  num: string;
  title: string;
  why: string;
  how: string;
  record_hint: string;
  perspective: string;
  tone: string;
  suggest: string;
  illustration_path: string | null;
  recurring: string | null;
  spot_note: string;
  reminder_text: string;
  created_at: string;
}

export interface Wardrobe {
  id: string;
  name: string;
  slot: string;
  at: number;
  line: string;
}

export interface InviteToken {
  id: string;
  family_id: string;
  created_by: string;
  level_num: string;
  level_title: string;
  level_why: string;
  level_how: string;
  level_record: string;
  level_suggest: string;
  level_tone: string;
  perspective: string;
  kid_id: string | null;
  kid_name: string | null;
  inviter_role: string;
  illustration_path: string | null;
  expires_at: string;
  opened_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NotificationTemplate {
  id: number;
  scene: string;
  species: string;
  lang: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
}

export interface NotificationLog {
  id: number;
  kid_id: string;
  family_id: string;
  scene: string;
  template_id: number | null;
  sent_at: string;
  clicked: boolean;
  clicked_at: string | null;
}

export interface NotificationOutbox {
  id: number;
  family_id: string;
  kid_id: string;
  scene: string;
  payload: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
}

export interface PushDevice {
  device_id: string;
  user_id: string;
  token: string | null;
  platform: string | null;
  lang: string;
  tz_offset: number;
  updated_at: string;
}

export interface AppConfig {
  key: string;
  value: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: number;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  updated_at: string;
}
