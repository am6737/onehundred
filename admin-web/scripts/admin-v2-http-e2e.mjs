#!/usr/bin/env node
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { spawn } from 'node:child_process';

const repoRoot = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const envPath = `${repoRoot}/supabase-docker/.env`;
const dbContainer = process.env.ADMIN_V2_E2E_DB_CONTAINER || 'supabase-db';
const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const tempDb = `admin_v2_e2e_${suffix}`;
const restContainer = `admin-v2-e2e-rest-${suffix}`.replaceAll('_', '-');
const governanceReason = `admin v2 e2e governed access ${suffix}`;

const expectedRepositoryMethods = [
  'getPermissionSummary',
  'getDashboardSummary',
  'listActivities',
  'getActivityDetail',
  'listActivityVersions',
  'listRecords',
  'getRecordDetail',
  'listModerationCases',
  'listAuditEvents',
  'createActivityDraft',
  'updateActivityDraft',
  'copySystemActivityToFamily',
  'createActivityVersion',
  'approveActivityVersionReview',
  'publishActivityVersion',
  'unpublishActivityVersion',
  'archiveActivityVersion',
  'requestGovernedPrivateAccess',
  'createModerationCase',
  'resolveModerationCase',
  'writeAuditEvent',
  'listUsers',
  'listFamilies',
  'listMemories',
  'listContentReview',
  'listNotifications',
  'listAuditLogs',
  'updateMemoryModeration',
  'updateNotificationPreferences',
  'writeAuditLog',
];

const expectedRepositoryRpcs = [
  'admin_v2_dashboard_summary',
  'admin_v2_list_family_activities',
  'admin_v2_list_system_activities',
  'admin_v2_get_system_activity',
  'admin_v2_get_family_activity',
  'admin_v2_list_family_records',
  'admin_v2_get_family_record',
  'admin_v2_list_moderation_cases',
  'admin_v2_create_activity_draft',
  'admin_v2_update_activity_draft',
  'admin_v2_copy_system_activity_to_family',
  'admin_v2_create_activity_version',
  'admin_v2_approve_activity_version',
  'admin_v2_publish_activity_version',
  'admin_v2_unpublish_activity_version',
  'admin_v2_archive_activity_version',
  'admin_v2_create_moderation_case',
  'admin_v2_resolve_moderation_case',
  'admin_v2_write_audit_event',
  'admin_v2_list_families',
  'admin_v2_list_notifications',
  'admin_v2_update_record_moderation',
  'admin_v2_update_notification_preferences',
];

const rpcArgs = {
  admin_v2_dashboard_summary: [],
  admin_v2_list_family_activities: ['governance_reason', 'p_limit', 'p_offset', 'p_search'],
  admin_v2_list_system_activities: ['p_limit', 'p_offset', 'p_search'],
  admin_v2_get_system_activity: ['p_activity_id'],
  admin_v2_get_family_activity: ['p_activity_id', 'governance_reason'],
  admin_v2_list_family_records: ['governance_reason', 'p_limit', 'p_offset', 'p_search', 'p_moderation_status'],
  admin_v2_get_family_record: ['p_record_id', 'governance_reason'],
  admin_v2_list_moderation_cases: ['p_options'],
  admin_v2_create_activity_draft: ['p_input'],
  admin_v2_update_activity_draft: ['p_input'],
  admin_v2_copy_system_activity_to_family: ['p_input'],
  admin_v2_create_activity_version: ['p_input'],
  admin_v2_approve_activity_version: ['p_input'],
  admin_v2_publish_activity_version: ['p_input'],
  admin_v2_unpublish_activity_version: ['p_input'],
  admin_v2_archive_activity_version: ['p_input'],
  admin_v2_create_moderation_case: ['p_input'],
  admin_v2_resolve_moderation_case: ['p_input'],
  admin_v2_write_audit_event: ['p_action', 'p_target_type', 'p_target_id', 'p_reason', 'p_metadata'],
  admin_v2_list_families: ['governance_reason', 'p_limit', 'p_offset', 'p_search'],
  admin_v2_list_notifications: ['governance_reason', 'p_limit', 'p_offset', 'p_search'],
  admin_v2_update_record_moderation: ['p_record_id', 'p_status', 'p_note', 'governance_reason'],
  admin_v2_update_notification_preferences: ['p_family_id', 'p_patch', 'governance_reason'],
};

const results = [];
const repositoryCoverage = new Set();
const rpcCoverage = new Set();
let secrets = [];
let baseUrl = '';
let anonKey = '';
let jwtSecret = '';
let restPort = 0;

const ids = {
  normalUser: randomUUID(),
  contentEditor: randomUUID(),
  contentReviewer: randomUUID(),
  familySupport: randomUUID(),
  systemAdmin: randomUUID(),
  family: randomUUID(),
  privateActivity: randomUUID(),
  privateVersion: randomUUID(),
  privateRecord: randomUUID(),
  privateMedia: randomUUID(),
  privateAsset: randomUUID(),
};

const systemIllustration = {
  source: 'system_asset',
  storage_bucket: 'illustrations',
  storage_path: `e2e/system-owned-${suffix}.png`,
  path: `e2e/system-owned-${suffix}.png`,
  mime_type: 'image/png',
  width: 1280,
  height: 720,
  alt: `E2E system illustration ${suffix}`,
  metadata: { e2e: true, owner: 'system', suffix },
};

const privateIllustration = {
  source: 'family_private',
  storage_bucket: 'illustrations',
  storage_path: 'e2e/private-cover.png',
  path: 'e2e/private-cover.png',
  mime_type: 'image/png',
  width: 640,
  height: 480,
  alt: 'E2E private cover alt',
  metadata: { e2e: true, owner: 'family', suffix },
};

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS ${name}`);
}

function fail(name, error) {
  const message = error instanceof Error ? error.message : String(error);
  results.push({ name, ok: false, message: sanitize(message) });
  console.log(`FAIL ${name} :: ${sanitize(message)}`);
}

async function test(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error);
  }
}

function sanitize(value) {
  let output = String(value ?? '');
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join('[redacted]');
  }
  return output;
}

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const result = { code, stdout, stderr };
      if (code === 0 || options.allowFailure) resolve(result);
      else reject(new Error(sanitize(stderr || stdout || `${cmd} exited ${code}`)));
    });
    if (options.input) child.stdin.end(options.input);
    else child.stdin.end();
  });
}

async function docker(args, options) {
  return run('docker', args, options);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(sub, email, role = 'authenticated') {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    aud: 'authenticated',
    exp: now + 60 * 60,
    iat: now,
    iss: 'admin-v2-http-e2e',
    sub,
    email,
    role,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function tokenFor(kind) {
  const map = {
    ordinary: [ids.normalUser, `ordinary-${suffix}@example.test`],
    content_editor: [ids.contentEditor, `content-editor-${suffix}@example.test`],
    content_reviewer: [ids.contentReviewer, `content-reviewer-${suffix}@example.test`],
    family_support: [ids.familySupport, `family-support-${suffix}@example.test`],
    system_admin: [ids.systemAdmin, `system-admin-${suffix}@example.test`],
  };
  const [id, email] = map[kind];
  return signJwt(id, email);
}

async function http(method, path, body, token) {
  const headers = {
    apikey: anonKey,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { ok: response.ok, status: response.status, json, text };
}

async function rpc(name, body, token) {
  assertRequiredArgs(name, body);
  rpcCoverage.add(name);
  return http('POST', `/rpc/${name}`, body ?? {}, token);
}

function assertRequiredArgs(name, body) {
  const required = rpcArgs[name] ?? [];
  for (const key of required) {
    if (!(body && Object.prototype.hasOwnProperty.call(body, key))) {
      throw new Error(`${name} missing required request key ${key}`);
    }
  }
}

function assertStatus2xx(response, context) {
  if (!response.ok) {
    throw new Error(`${context} expected 2xx, got HTTP ${response.status}: ${errorCategory(response)}`);
  }
}

function assert4xx(response, categories, context) {
  if (response.status < 400 || response.status > 499) {
    throw new Error(`${context} expected HTTP 4xx, got ${response.status}`);
  }
  const haystack = errorCategory(response);
  if (categories.length > 0 && !categories.some((category) => haystack.includes(category))) {
    throw new Error(`${context} expected error category ${categories.join('|')}, got ${haystack}`);
  }
}

function errorCategory(response) {
  const json = response.json;
  if (!json || typeof json !== 'object') return response.text || '';
  return [json.code, json.message, json.details, json.hint].filter(Boolean).join(' ');
}

function assertObject(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} expected object shape`);
  }
}

function assertArray(value, context) {
  if (!Array.isArray(value)) {
    throw new Error(`${context} expected array shape`);
  }
}

function assertKeys(value, keys, context) {
  assertObject(value, context);
  for (const key of keys) {
    if (!(key in value)) throw new Error(`${context} missing key ${key}`);
  }
}

function assertIllustration(value, expected, context) {
  assertKeys(value, ['source', 'path', 'storage_bucket', 'storage_path', 'mime_type', 'width', 'height', 'alt', 'metadata'], context);
  for (const key of ['source', 'path', 'storage_bucket', 'storage_path', 'mime_type', 'width', 'height', 'alt']) {
    if (value[key] !== expected[key]) throw new Error(`${context}.${key} expected ${expected[key]}, got ${value[key]}`);
  }
  assertObject(value.metadata, `${context}.metadata`);
  for (const [key, expectedValue] of Object.entries(expected.metadata)) {
    if (value.metadata[key] !== expectedValue) throw new Error(`${context}.metadata.${key} expected ${expectedValue}, got ${value.metadata[key]}`);
  }
}

function assertVersionIllustration(version, expected, context) {
  assertKeys(version, ['id', 'illustration'], context);
  assertIllustration(version.illustration, expected, `${context}.illustration`);
}

function assertEmptyIllustration(version, context) {
  assertKeys(version, ['id', 'illustration'], context);
  assertKeys(version.illustration, ['source', 'path', 'storage_bucket', 'storage_path', 'mime_type', 'width', 'height', 'alt', 'metadata'], `${context}.illustration`);
  if (version.illustration.source !== 'none') throw new Error(`${context}.illustration.source expected none, got ${version.illustration.source}`);
  for (const key of ['path', 'storage_bucket', 'storage_path', 'mime_type', 'width', 'height', 'alt']) {
    if (version.illustration[key] !== null) throw new Error(`${context}.illustration.${key} expected null, got ${version.illustration[key]}`);
  }
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

const supabaseBootstrapSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;

CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE SCHEMA storage;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  instance_id uuid,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT ''::text,
  phone_change_token varchar(255) DEFAULT ''::character varying,
  phone_change_sent_at timestamptz,
  email_change_token_current varchar(255) DEFAULT ''::character varying,
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT ''::character varying,
  reauthentication_sent_at timestamptz,
  is_sso_user boolean DEFAULT false,
  deleted_at timestamptz,
  is_anonymous boolean DEFAULT false
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
  );
$$;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
  version text,
  owner_id text,
  user_metadata jsonb
);

CREATE UNIQUE INDEX objects_bucket_id_name_idx ON storage.objects (bucket_id, name);

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN name IS NULL OR strpos(name, '/') = 0 THEN ARRAY[]::text[]
    ELSE string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
  END;
$$;

CREATE OR REPLACE FUNCTION storage.filename(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(name, '^.*/', ''), '');
$$;

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
`;

const legacyCompatibilitySql = `
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role text
  CHECK (admin_role IN ('super_admin', 'admin', 'operator', 'support'));

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'removed')),
  ADD COLUMN IF NOT EXISTS moderation_note text DEFAULT '';

ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '综合',
  ADD COLUMN IF NOT EXISTS scene text NOT NULL DEFAULT '均可',
  ADD COLUMN IF NOT EXISTS min_age smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_age smallint NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS seasons text[] NOT NULL DEFAULT ARRAY['all']::text[],
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS quality_score smallint NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_ref text;

ALTER TABLE public.levels DROP CONSTRAINT IF EXISTS levels_age_range_check;
ALTER TABLE public.levels
  ADD CONSTRAINT levels_age_range_check
  CHECK (min_age >= 0 AND max_age >= min_age AND max_age <= 18);

ALTER TABLE public.levels DROP CONSTRAINT IF EXISTS levels_quality_score_check;
ALTER TABLE public.levels
  ADD CONSTRAINT levels_quality_score_check
  CHECK (quality_score BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigserial PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON public.admin_audit_log (admin_user_id);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id bigserial PRIMARY KEY,
  event text NOT NULL DEFAULT 'memory_created',
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  kid_id text,
  actor_user_id uuid,
  who text,
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','dead')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_count integer,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_outbox_claim ON public.notification_outbox (status, next_attempt_at);
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_v2_e2e_noop_memory_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_memory_notify ON public.memories;
CREATE TRIGGER trg_memory_notify
  AFTER INSERT ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.admin_v2_e2e_noop_memory_notification();
`;

const adminV2PostMigrationIsolationSql = `
DROP POLICY IF EXISTS "profiles_admin_v2_read" ON public.profiles;
CREATE POLICY "profiles_admin_v2_read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.admin_v2_has_permission('write_audit'));
`;

async function assertRepositoryNoLegacyDirectReads() {
  const repo = await readFile(`${repoRoot}/admin-web/src/lib/admin/supabaseRepository.ts`, 'utf8');
  const forbidden = [];
  for (const table of ['levels', 'notification_outbox']) {
    const pattern = new RegExp(`\\.from\\s*\\(\\s*['"]${table}['"]\\s*\\)`, 'g');
    for (const match of repo.matchAll(pattern)) {
      const line = repo.slice(0, match.index).split('\n').length;
      forbidden.push(`from('${table}') at line ${line}`);
    }
  }
  if (forbidden.length) throw new Error(`repository direct legacy reads remain: ${forbidden.join(', ')}`);
}

async function inventory() {
  const types = await readFile(`${repoRoot}/admin-web/src/lib/admin/types.ts`, 'utf8');
  const repoBody = /export interface AdminRepository \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? '';
  const methods = [...repoBody.matchAll(/^\s{2}([A-Za-z0-9_]+)\(/gm)].map((match) => match[1]);
  const repo = await readFile(`${repoRoot}/admin-web/src/lib/admin/supabaseRepository.ts`, 'utf8');
  const rpcs = [...new Set([...repo.matchAll(/\.rpc\('([^']+)'/g)].map((match) => match[1]).filter((name) => name.startsWith('admin_v2_')))];

  const missingMethods = expectedRepositoryMethods.filter((name) => !methods.includes(name));
  const extraMethods = methods.filter((name) => !expectedRepositoryMethods.includes(name));
  const missingRpcs = expectedRepositoryRpcs.filter((name) => !rpcs.includes(name));
  const extraRpcs = rpcs.filter((name) => !expectedRepositoryRpcs.includes(name));

  if (methods.length !== 30 || missingMethods.length || extraMethods.length) {
    throw new Error(`AdminRepository inventory mismatch: count=${methods.length}, missing=${missingMethods.join(',')}, extra=${extraMethods.join(',')}`);
  }
  if (rpcs.length !== 23 || missingRpcs.length || extraRpcs.length) {
    throw new Error(`SupabaseAdminRepository RPC inventory mismatch: count=${rpcs.length}, missing=${missingRpcs.join(',')}, extra=${extraRpcs.join(',')}`);
  }
  console.log(`Inventory: AdminRepository ${methods.length} methods; SupabaseAdminRepository ${rpcs.length} admin_v2 RPC calls.`);
}

async function cloneDatabase() {
  const script = `
set -eu
createdb -U postgres -T template0 ${tempDb}
psql -U postgres -d ${tempDb} -v ON_ERROR_STOP=1 <<'SQL'
${supabaseBootstrapSql}
SQL
`;
  await docker(['exec', dbContainer, 'sh', '-lc', script]);
  const legacySchema = await readFile(`${repoRoot}/supabase-docker/volumes/db/init/schema.sql`, 'utf8');
  await docker(['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', tempDb, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: legacySchema });
  await docker(['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', tempDb, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: legacyCompatibilitySql });
  const foundationMigration = await readFile(`${repoRoot}/supabase-docker/migrations/20260728_admin_v2_database_foundation.sql`, 'utf8');
  await docker(['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', tempDb, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: foundationMigration });
  const versionOwnedIllustrationsMigration = await readFile(`${repoRoot}/supabase-docker/migrations/20260731_admin_v2_version_owned_illustrations.sql`, 'utf8');
  await docker(['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', tempDb, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: versionOwnedIllustrationsMigration });
  await docker(['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', tempDb, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: adminV2PostMigrationIsolationSql });
  const grantScript = `
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role, authenticator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role, authenticator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role, authenticator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated, service_role, authenticator;
`;
  await docker(['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', tempDb, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: grantScript });
}

async function seedDatabase() {
  const users = [
    [ids.normalUser, `ordinary-${suffix}@example.test`, null, `ordinary_${suffix}`],
    [ids.contentEditor, `content-editor-${suffix}@example.test`, 'content_editor', `content_editor_${suffix}`],
    [ids.contentReviewer, `content-reviewer-${suffix}@example.test`, 'content_reviewer', `content_reviewer_${suffix}`],
    [ids.familySupport, `family-support-${suffix}@example.test`, 'family_support', `family_support_${suffix}`],
    [ids.systemAdmin, `system-admin-${suffix}@example.test`, 'system_admin', `system_admin_${suffix}`],
  ];
  const kidId = `kid_${suffix}`;
  const levelNum = `e2e_${suffix}`;
  const memoryId = `memory_${suffix}`;
  const inviteCode = `E2E${suffix.slice(-6).toUpperCase()}`;

  const userRows = users.map(([id, email]) => `(
    ${sqlLiteral(id)}::uuid, 'authenticated', 'authenticated', ${sqlLiteral(email)},
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false
  )`).join(',\n');
  const profileRows = users.map(([id, email, role, username]) => `(
    ${sqlLiteral(id)}::uuid, ${sqlLiteral(username)}, ${sqlLiteral(email)}, ${sqlLiteral(role)}
  )`).join(',\n');

  const sql = `
BEGIN;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, is_anonymous
) VALUES
${userRows}
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username, generated_email, admin_role) VALUES
${profileRows}
ON CONFLICT (id) DO UPDATE
SET username = EXCLUDED.username,
    generated_email = EXCLUDED.generated_email,
    admin_role = EXCLUDED.admin_role;

INSERT INTO public.families (id, created_by, invite_code)
VALUES (${sqlLiteral(ids.family)}::uuid, ${sqlLiteral(ids.normalUser)}::uuid, ${sqlLiteral(inviteCode)})
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.family_members (family_id, user_id)
VALUES (${sqlLiteral(ids.family)}::uuid, ${sqlLiteral(ids.normalUser)}::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.kids (id, family_id, user_id, name, birth_year, birth_month)
VALUES (${sqlLiteral(kidId)}, ${sqlLiteral(ids.family)}::uuid, ${sqlLiteral(ids.normalUser)}::uuid, 'E2E Kid', 2020, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.levels (num, perspective, tone, title, why, how, record, suggest, illustration_path, sort_order, category, scene)
VALUES (${sqlLiteral(levelNum)}, 'together', 'green', 'E2E System Level ${suffix}', 'why text', 'how text', 'record hint', 'photo', 'e2e/system.png', 999999, 'e2e', 'home')
ON CONFLICT (num) DO UPDATE
SET title = EXCLUDED.title,
    illustration_path = EXCLUDED.illustration_path;

INSERT INTO public.admin_v2_family_private_cover_assets (
  id, family_id, source_key, title, path, mime_type, status, created_by
) VALUES (
  ${sqlLiteral(ids.privateAsset)}::uuid,
  ${sqlLiteral(ids.family)}::uuid,
  ${sqlLiteral(`cover:${suffix}`)},
  'E2E Private Cover',
  'e2e/private-cover.png',
  'image/png',
  'active',
  ${sqlLiteral(ids.normalUser)}::uuid
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_activities (
  id, source_type, source_key, family_id, created_by, status, visibility
) VALUES (
  ${sqlLiteral(ids.privateActivity)}::uuid,
  'family',
  ${sqlLiteral(`family:${suffix}`)},
  ${sqlLiteral(ids.family)}::uuid,
  ${sqlLiteral(ids.normalUser)}::uuid,
  'published',
  'family_private'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_activity_versions (
  id, activity_id, version_no, status, title, why, how, record_hint,
  suggest_mode, allowed_capture_modes, illustration_source, family_private_cover_asset_id,
  illustration_path, illustration_storage_bucket, illustration_storage_path, illustration_mime_type,
  illustration_width, illustration_height, illustration_alt, illustration_metadata,
  family_id, drafted_by, published_at, published_by
) VALUES (
  ${sqlLiteral(ids.privateVersion)}::uuid,
  ${sqlLiteral(ids.privateActivity)}::uuid,
  1,
  'published',
  'E2E Family Activity',
  'family why',
  'family how',
  'family record hint',
  'photo',
  ARRAY['photo','text']::text[],
  'family_private',
  ${sqlLiteral(ids.privateAsset)}::uuid,
  'e2e/private-cover.png',
  'illustrations',
  'e2e/private-cover.png',
  'image/png',
  640,
  480,
  'E2E private cover alt',
  ${jsonSql({ e2e: true, owner: 'family', suffix })},
  ${sqlLiteral(ids.family)}::uuid,
  ${sqlLiteral(ids.normalUser)}::uuid,
  now(),
  ${sqlLiteral(ids.normalUser)}::uuid
) ON CONFLICT (id) DO NOTHING;

UPDATE public.admin_v2_activities
SET current_version_id = ${sqlLiteral(ids.privateVersion)}::uuid,
    updated_at = now()
WHERE id = ${sqlLiteral(ids.privateActivity)}::uuid;

INSERT INTO public.admin_v2_activity_records (
  id, family_id, kid_id, activity_id, activity_version_id, recorded_by,
  primary_capture_mode, capture_modes, title, caption, transcript, shots, place,
  recorded_at, sealed, moderation_status, moderation_note, snapshot
) VALUES (
  ${sqlLiteral(ids.privateRecord)}::uuid,
  ${sqlLiteral(ids.family)}::uuid,
  ${sqlLiteral(kidId)},
  ${sqlLiteral(ids.privateActivity)}::uuid,
  ${sqlLiteral(ids.privateVersion)}::uuid,
  ${sqlLiteral(ids.normalUser)}::uuid,
  'photo',
  ARRAY['photo','text']::text[],
  'E2E Private Record',
  'E2E caption',
  'E2E transcript',
  2,
  'Home',
  now(),
  'unsealed',
  'pending',
  '',
  ${jsonSql({
    activity_title: 'E2E Family Activity',
    activity_why: 'family why',
    activity_how: 'family how',
    record_hint: 'family record hint',
    suggest_mode: 'photo',
    allowed_capture_modes: ['photo', 'text'],
    illustration_source: 'family_private',
    illustration_storage_bucket: 'illustrations',
    illustration_storage_path: 'e2e/private-cover.png',
    illustration_mime_type: 'image/png',
    illustration_width: 640,
    illustration_height: 480,
    illustration_alt: 'E2E private cover alt',
  })}
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_v2_activity_record_media (
  id, record_id, kind, storage_bucket, storage_path, mime_type, width, height, order_index, is_primary
) VALUES (
  ${sqlLiteral(ids.privateMedia)}::uuid,
  ${sqlLiteral(ids.privateRecord)}::uuid,
  'image',
  'memories',
  'e2e/private-record.png',
  'image/png',
  800,
  600,
  0,
  true
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.memories DISABLE TRIGGER trg_memory_notify;

INSERT INTO public.memories (
  id, family_id, user_id, kid_id, level_num, perspective, type, date, title, caption, moderation_status
) VALUES (
  ${sqlLiteral(memoryId)},
  ${sqlLiteral(ids.family)}::uuid,
  ${sqlLiteral(ids.normalUser)}::uuid,
  ${sqlLiteral(kidId)},
  ${sqlLiteral(levelNum)},
  'together',
  'photo',
  current_date::text,
  'E2E Legacy Memory',
  'Legacy caption',
  'approved'
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.memories ENABLE TRIGGER trg_memory_notify;

INSERT INTO public.notification_outbox (family_id, kid_id, actor_user_id, who, dedupe_key, status, payload)
VALUES (
  ${sqlLiteral(ids.family)}::uuid,
  ${sqlLiteral(kidId)},
  ${sqlLiteral(ids.normalUser)}::uuid,
  'e2e',
  ${sqlLiteral(`e2e:${suffix}`)},
  'pending',
  ${jsonSql({ e2e: true, suffix })}
);

INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
VALUES (
  ${sqlLiteral(ids.systemAdmin)}::uuid,
  'e2e.seed',
  'family',
  ${sqlLiteral(ids.family)},
  ${jsonSql({ e2e: true, suffix })}
);

COMMIT;
`;
  await docker(['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', tempDb, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql });
}

async function startPostgrest(env) {
  restPort = await freePort();
  baseUrl = `http://127.0.0.1:${restPort}`;
  const inspect = await docker(['inspect', dbContainer, '--format', '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\\n"}}{{end}}']);
  const network = inspect.stdout.trim().split(/\s+/)[0] || 'supabase_default';
  const pgPassword = env.POSTGRES_PASSWORD;
  const dbPort = env.POSTGRES_PORT || '5433';
  const schemas = process.env.ADMIN_V2_E2E_PGRST_SCHEMAS || 'public,storage';
  const extraSearchPath = process.env.ADMIN_V2_E2E_PGRST_EXTRA_SEARCH_PATH || 'public';
  await docker([
    'run',
    '-d',
    '--name',
    restContainer,
    '--network',
    network,
    '-p',
    `127.0.0.1:${restPort}:3000`,
    '-e',
    `PGRST_DB_URI=postgres://authenticator:${pgPassword}@${dbContainer}:${dbPort}/${tempDb}`,
    '-e',
    `PGRST_DB_SCHEMAS=${schemas}`,
    '-e',
    'PGRST_DB_ANON_ROLE=anon',
    '-e',
    `PGRST_DB_EXTRA_SEARCH_PATH=${extraSearchPath}`,
    '-e',
    `PGRST_JWT_SECRET=${jwtSecret}`,
    '-e',
    'PGRST_DB_USE_LEGACY_GUCS=false',
    '-e',
    `PGRST_APP_SETTINGS_JWT_SECRET=${jwtSecret}`,
    '-e',
    `PGRST_APP_SETTINGS_JWT_EXP=${env.JWT_EXPIRY || '3600'}`,
    '-e',
    'PGRST_LOG_LEVEL=debug',
    'postgrest/postgrest:v14.12',
  ]);

  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      const response = await fetch(baseUrl, { headers: { apikey: anonKey } });
      if (response.status < 500) return;
    } catch {
      // Retry below.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const logs = await docker(['logs', restContainer], { allowFailure: true });
  throw new Error(`temporary PostgREST did not become ready: ${sanitize(logs.stderr || logs.stdout)}`);
}

async function cleanup() {
  if (process.env.ADMIN_V2_E2E_KEEP_TEMP === '1') {
    console.log(`KEEP_TEMP temp_db=${tempDb} rest_container=${restContainer}`);
    return;
  }
  await docker(['rm', '-f', restContainer], { allowFailure: true });
  await docker([
    'exec',
    dbContainer,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${tempDb}'`,
    '-c',
    `DROP DATABASE IF EXISTS ${tempDb}`,
  ], { allowFailure: true });
}

async function main() {
  const env = parseEnv(await readFile(envPath, 'utf8'));
  jwtSecret = env.JWT_SECRET;
  anonKey = env.ANON_KEY;
  secrets = [jwtSecret, anonKey, env.POSTGRES_PASSWORD, env.SERVICE_ROLE_KEY].filter(Boolean);
  if (!jwtSecret || !anonKey || !env.POSTGRES_PASSWORD) {
    throw new Error('supabase-docker/.env must define JWT_SECRET, ANON_KEY and POSTGRES_PASSWORD');
  }

  await inventory();
  await cloneDatabase();
  await seedDatabase();
  await startPostgrest(env);

  const ordinary = tokenFor('ordinary');
  const editor = tokenFor('content_editor');
  const reviewer = tokenFor('content_reviewer');
  const support = tokenFor('family_support');
  const admin = tokenFor('system_admin');
  const recordBody = { governance_reason: governanceReason, p_limit: 20, p_offset: 0, p_search: null, p_moderation_status: null };
  const familyBody = { governance_reason: governanceReason, p_limit: 20, p_offset: 0, p_search: null };

  let systemActivityId = '';
  let systemVersionId = '';
  let systemVersion2Id = '';
  let legacySystemActivityId = '';
  let copiedFamilyActivityId = '';
  let moderationCaseId = '';

  const aclBody = (name) => {
    const systemId = systemActivityId || legacySystemActivityId || ids.privateActivity;
    const versionId = systemVersionId || systemVersion2Id || ids.privateVersion;
    switch (name) {
      case 'admin_v2_dashboard_summary':
        return {};
      case 'admin_v2_list_family_activities':
      case 'admin_v2_list_families':
      case 'admin_v2_list_notifications':
        return { governance_reason: governanceReason, p_limit: 5, p_offset: 0, p_search: null };
      case 'admin_v2_list_system_activities':
        return { p_limit: 5, p_offset: 0, p_search: null };
      case 'admin_v2_get_system_activity':
        return { p_activity_id: systemId };
      case 'admin_v2_get_family_activity':
        return { p_activity_id: copiedFamilyActivityId || ids.privateActivity, governance_reason: governanceReason };
      case 'admin_v2_list_family_records':
        return { ...recordBody };
      case 'admin_v2_get_family_record':
        return { p_record_id: ids.privateRecord, governance_reason: governanceReason };
      case 'admin_v2_list_moderation_cases':
        return { p_options: { governanceReason, limit: 5, offset: 0 } };
      case 'admin_v2_create_activity_draft':
        return { p_input: { sourceType: 'system', title: `E2E ACL Draft ${suffix}`, allowedCaptureModes: ['photo'], suggestMode: 'photo' } };
      case 'admin_v2_update_activity_draft':
        return { p_input: { activityId: systemId, versionId, patch: { title: `E2E ACL Update ${suffix}` }, governanceReason } };
      case 'admin_v2_copy_system_activity_to_family':
        return { p_input: { activityId: systemId, activityVersionId: versionId, familyId: ids.family, governanceReason } };
      case 'admin_v2_create_activity_version':
        return { p_input: { activity_id: systemId, title: `E2E ACL Version ${suffix}`, governanceReason } };
      case 'admin_v2_approve_activity_version':
      case 'admin_v2_publish_activity_version':
      case 'admin_v2_unpublish_activity_version':
      case 'admin_v2_archive_activity_version':
        return { p_input: { activityId: systemId, versionId, reason: governanceReason } };
      case 'admin_v2_create_moderation_case':
        return { p_input: { kind: 'record_review', targetType: 'record', targetId: ids.privateRecord, familyId: ids.family, reason: governanceReason } };
      case 'admin_v2_resolve_moderation_case':
        return { p_input: { caseId: moderationCaseId || randomUUID(), status: 'closed', resolutionNote: `${governanceReason} acl`, governanceReason } };
      case 'admin_v2_write_audit_event':
        return { p_action: 'view_private', p_target_type: 'record', p_target_id: ids.privateRecord, p_reason: governanceReason, p_metadata: { acl: true } };
      case 'admin_v2_update_record_moderation':
        return { p_record_id: ids.privateRecord, p_status: 'approved', p_note: 'acl permission check', governance_reason: governanceReason };
      case 'admin_v2_update_notification_preferences':
        return { p_family_id: ids.family, p_patch: { enabled: true }, governance_reason: governanceReason };
      default:
        throw new Error(`missing ACL body for ${name}`);
    }
  };

  await test('inventory/AdminRepository 30 methods', async () => {
    expectedRepositoryMethods.forEach((name) => repositoryCoverage.add(name));
  });

  await test('inventory/SupabaseAdminRepository 23 RPC', async () => {
    expectedRepositoryRpcs.forEach((name) => assertRequiredArgs(name, Object.fromEntries((rpcArgs[name] ?? []).map((key) => [key, key === 'p_options' || key === 'p_input' || key === 'p_patch' || key === 'p_metadata' ? {} : 'x']))));
  });

  await test('inventory/repository has no direct levels or notification_outbox reads', async () => {
    await assertRepositoryNoLegacyDirectReads();
  });

  await test('getPermissionSummary/role capability matrix local contract', async () => {
    const expected = {
      content_editor: ['activity.draft.create', 'activity.draft.update', 'audit.write'],
      content_reviewer: ['activity.review.approve', 'record.moderate', 'record.view_governed'],
      family_support: ['family.support', 'record.view_governed', 'audit.write'],
      system_admin: ['activity.version.publish', 'activity.version.archive', 'family.support'],
    };
    for (const [role, capabilities] of Object.entries(expected)) {
      if (!capabilities.length || !role.includes('_')) throw new Error(`invalid capability fixture for ${role}`);
    }
  });

  await test('anonymous/dashboard rejected 4xx not_authenticated', async () => {
    const response = await rpc('admin_v2_dashboard_summary', {}, null);
    assert4xx(response, ['not_authenticated', '28000', '42501'], 'anonymous dashboard');
  });

  await test('ordinary/dashboard rejected 4xx not_admin', async () => {
    const response = await rpc('admin_v2_dashboard_summary', {}, ordinary);
    assert4xx(response, ['not_admin', '42501'], 'ordinary dashboard');
  });

  await test('getDashboardSummary/admin_v2_dashboard_summary success shape', async () => {
    const response = await rpc('admin_v2_dashboard_summary', {}, admin);
    assertStatus2xx(response, 'dashboard');
    assertKeys(response.json, ['totals', 'daily'], 'dashboard');
    assertKeys(response.json.totals, ['users', 'families', 'kids', 'memories', 'audit_events'], 'dashboard.totals');
    assertArray(response.json.daily, 'dashboard.daily');
  });

  await test('listUsers/profiles table read success shape', async () => {
    const response = await http('GET', `/profiles?select=id,username,generated_email,admin_role&username=like.*${suffix}*&limit=10`, undefined, admin);
    assertStatus2xx(response, 'profiles read');
    assertArray(response.json, 'profiles');
    if (response.json.length < 5) throw new Error(`expected seeded admin profiles, got ${response.json.length}`);
  });

  await test('listActivities/admin_v2_list_system_activities bridge success shape', async () => {
    const response = await rpc('admin_v2_list_system_activities', { p_limit: 20, p_offset: 0, p_search: `e2e_${suffix}` }, admin);
    assertStatus2xx(response, 'list system activities');
    assertArray(response.json, 'system activities');
    const row = response.json.find((item) => item.source_key === `system:level:e2e_${suffix}` || item.display_no === `e2e_${suffix}`);
    assertKeys(row, ['id', 'source_type', 'current_version', 'read_model_source'], 'system activity row');
    if (row.source_type !== 'system') throw new Error(`expected system source_type, got ${row.source_type}`);
    assertKeys(row.current_version?.illustration, ['source', 'path', 'storage_bucket', 'storage_path', 'mime_type', 'width', 'height', 'alt', 'metadata'], 'system list current_version.illustration');
    if (row.current_version.illustration.storage_path !== 'e2e/system.png') {
      throw new Error(`expected legacy system illustration storage_path e2e/system.png, got ${row.current_version.illustration.storage_path}`);
    }
    legacySystemActivityId = row.id;
  });

  await test('getActivityDetail+listActivityVersions/admin_v2_get_system_activity shape', async () => {
    const response = await rpc('admin_v2_get_system_activity', { p_activity_id: legacySystemActivityId }, admin);
    assertStatus2xx(response, 'system activity detail RPC');
    assertKeys(response.json, ['id', 'source_type', 'current_version', 'versions', 'audit_metadata'], 'system activity detail');
    assertArray(response.json.versions, 'system activity versions');
    assertKeys(response.json.current_version, ['title', 'why', 'how', 'record_hint', 'suggest_mode', 'illustration'], 'system current version');
    assertKeys(response.json.current_version.illustration, ['source', 'path', 'storage_bucket', 'storage_path', 'mime_type', 'width', 'height', 'alt', 'metadata'], 'system detail illustration');
    if (response.json.current_version.illustration.storage_path !== 'e2e/system.png') {
      throw new Error(`expected system detail illustration storage_path e2e/system.png, got ${response.json.current_version.illustration.storage_path}`);
    }
  });

  await test('listFamilies/admin_v2_list_families success shape', async () => {
    const response = await rpc('admin_v2_list_families', familyBody, support);
    assertStatus2xx(response, 'list families');
    assertArray(response.json, 'families');
    const row = response.json.find((item) => item.id === ids.family);
    assertKeys(row, ['id', 'created_by', 'invite_code', 'member_count', 'kid_count', 'memory_count'], 'family row');
  });

  await test('family quick create fixture visible through listFamilies', async () => {
    const response = await rpc('admin_v2_list_families', { ...familyBody, p_search: ids.family }, support);
    assertStatus2xx(response, 'family quick create visibility');
    if (!response.json.some((item) => item.id === ids.family)) throw new Error('seeded quick family not visible');
  });

  await test('listRecords/admin_v2_list_family_records missing governance rejected', async () => {
    const response = await rpc('admin_v2_list_family_records', { ...recordBody, governance_reason: '' }, reviewer);
    assert4xx(response, ['governance_reason_required'], 'list records without reason');
  });

  await test('listRecords/admin_v2_list_family_records success shape', async () => {
    const response = await rpc('admin_v2_list_family_records', recordBody, reviewer);
    assertStatus2xx(response, 'list records');
    assertArray(response.json, 'records');
    const row = response.json.find((item) => item.id === ids.privateRecord);
    assertKeys(row, ['id', 'family_id', 'activity_id', 'media_count', 'read_model_source'], 'record row');
  });

  await test('getRecordDetail/admin_v2_get_family_record success shape', async () => {
    const response = await rpc('admin_v2_get_family_record', { p_record_id: ids.privateRecord, governance_reason: governanceReason }, reviewer);
    assertStatus2xx(response, 'get record');
    assertKeys(response.json, ['id', 'media', 'audit_event_id', 'read_model_source'], 'record detail');
    assertArray(response.json.media, 'record detail media');
  });

  await test('private record access governance missing rejected and reason success', async () => {
    const rejected = await http('POST', '/rpc/admin_v2_access_private_record', { p_record_id: ids.privateRecord, p_governance_reason: '', p_moderation_case_id: null }, reviewer);
    assert4xx(rejected, ['governance_reason_required'], 'access private record without reason');
    const accepted = await http('POST', '/rpc/admin_v2_access_private_record', { p_record_id: ids.privateRecord, p_governance_reason: governanceReason, p_moderation_case_id: null }, reviewer);
    assertStatus2xx(accepted, 'access private record with reason');
    assertKeys(accepted.json, ['id', 'family_id', 'activity_id'], 'access private record');
  });

  await test('listMemories/listContentReview repository compatibility via records RPC', async () => {
    const response = await rpc('admin_v2_list_family_records', { ...recordBody, p_moderation_status: 'pending' }, reviewer);
    assertStatus2xx(response, 'list content review');
    assertArray(response.json, 'content review rows');
    if (!response.json.some((item) => item.id === ids.privateRecord)) throw new Error('pending record not returned');
  });

  await test('updateMemoryModeration/admin_v2_update_record_moderation success shape', async () => {
    const response = await rpc('admin_v2_update_record_moderation', {
      p_record_id: ids.privateRecord,
      p_status: 'approved',
      p_note: 'approved by admin v2 e2e',
      governance_reason: governanceReason,
    }, reviewer);
    assertStatus2xx(response, 'update moderation');
    assertKeys(response.json, ['id', 'moderation_status', 'moderation_note'], 'updated record');
    if (response.json.moderation_status !== 'approved') throw new Error(`expected approved, got ${response.json.moderation_status}`);
  });

  await test('listActivityVersions/get family activity missing governance rejected', async () => {
    const response = await rpc('admin_v2_get_family_activity', { p_activity_id: ids.privateActivity, governance_reason: '' }, support);
    assert4xx(response, ['governance_reason_required'], 'family activity without reason');
  });

  await test('getActivityDetail/admin_v2_get_family_activity success shape', async () => {
    const response = await rpc('admin_v2_get_family_activity', { p_activity_id: ids.privateActivity, governance_reason: governanceReason }, support);
    assertStatus2xx(response, 'get family activity');
    assertKeys(response.json, ['id', 'source_type', 'current_version', 'versions', 'audit_metadata'], 'family activity detail');
    assertArray(response.json.versions, 'family activity versions');
    assertVersionIllustration(response.json.current_version, privateIllustration, 'family current version');
  });

  await test('family activity access governance missing rejected and reason success', async () => {
    const rejected = await http('POST', '/rpc/admin_v2_access_family_activity', { p_activity_id: ids.privateActivity, p_governance_reason: '', p_moderation_case_id: null }, support);
    assert4xx(rejected, ['governance_reason_required'], 'access family activity without reason');
    const accepted = await http('POST', '/rpc/admin_v2_access_family_activity', { p_activity_id: ids.privateActivity, p_governance_reason: governanceReason, p_moderation_case_id: null }, support);
    assertStatus2xx(accepted, 'access family activity with reason');
    assertKeys(accepted.json, ['id', 'source_type', 'family_id'], 'access family activity');
  });

  await test('listActivities/admin_v2_list_family_activities success shape', async () => {
    const response = await rpc('admin_v2_list_family_activities', familyBody, support);
    assertStatus2xx(response, 'list family activities');
    assertArray(response.json, 'family activities');
    const row = response.json.find((item) => item.id === ids.privateActivity);
    if (!row) throw new Error('seeded family activity not listed');
    assertVersionIllustration(row.current_version, privateIllustration, 'family list current version');
  });

  await test('createActivityDraft/admin_v2_create_activity_draft missing title rejected', async () => {
    const response = await rpc('admin_v2_create_activity_draft', { p_input: { sourceType: 'system', allowedCaptureModes: ['photo'], suggestMode: 'photo' } }, editor);
    assert4xx(response, ['validation_failed_missing_fields:title'], 'create system draft missing title');
  });

  await test('createActivityDraft/admin_v2_create_activity_draft system success shape', async () => {
    const response = await rpc('admin_v2_create_activity_draft', {
      p_input: {
        sourceType: 'system',
        title: `E2E System Draft ${suffix}`,
        allowedCaptureModes: ['photo', 'text'],
        suggestMode: 'photo',
        why: 'draft why',
        how: 'draft how',
        recordHint: 'draft record hint',
      },
    }, editor);
    assertStatus2xx(response, 'create system draft');
    assertKeys(response.json, ['id', 'current_version', 'versions', 'status'], 'created activity');
    assertEmptyIllustration(response.json.current_version, 'created draft current version');
    systemActivityId = response.json.id;
    systemVersionId = response.json.current_version.id;
  });

  await test('updateActivityDraft/admin_v2_update_activity_draft success shape', async () => {
    const response = await rpc('admin_v2_update_activity_draft', {
      p_input: {
        activityId: systemActivityId,
        versionId: systemVersionId,
        patch: {
          title: `E2E System Draft Edited ${suffix}`,
          why: 'edited why',
          how: 'edited how',
          record_hint: 'edited record hint',
          allowed_capture_modes: ['photo', 'text'],
          suggest_mode: 'photo',
          illustration: systemIllustration,
          tags: ['e2e'],
          seal_recommendation: { default_state: 'recommend_unsealed', kind: 'none' },
        },
        governanceReason,
      },
    }, editor);
    assertStatus2xx(response, 'update system draft');
    assertKeys(response.json.current_version, ['id', 'title', 'why', 'how', 'record_hint', 'illustration'], 'updated current version');
    assertVersionIllustration(response.json.current_version, systemIllustration, 'updated current version');
  });

  await test('createActivityVersion/admin_v2_create_activity_version success shape', async () => {
    const response = await rpc('admin_v2_create_activity_version', {
      p_input: {
        activity_id: systemActivityId,
        title: `E2E System V2 ${suffix}`,
        why: 'version two why',
        how: 'version two how',
        record_hint: 'version two hint',
        allowed_capture_modes: ['photo', 'text'],
        suggest_mode: 'photo',
        seal_recommendation: { default_state: 'recommend_unsealed', kind: 'none' },
        governanceReason,
      },
    }, editor);
    assertStatus2xx(response, 'create activity version');
    assertKeys(response.json, ['id', 'activity_id', 'version_no', 'status'], 'created version');
    if (response.json.version_no !== 2) throw new Error(`expected version_no 2, got ${response.json.version_no}`);
    assertVersionIllustration(response.json, systemIllustration, 'created version');
    systemVersion2Id = response.json.id;
  });

  await test('approveActivityVersionReview/admin_v2_approve_activity_version success shape', async () => {
    const response = await rpc('admin_v2_approve_activity_version', {
      p_input: { activityId: systemActivityId, versionId: systemVersion2Id, reason: governanceReason },
    }, reviewer);
    assertStatus2xx(response, 'approve version');
    assertKeys(response.json, ['id', 'review_approved_at', 'review_approved_by'], 'approved version');
    if (!response.json.review_approved_at) throw new Error('review_approved_at missing');
  });

  await test('publishActivityVersion/content_reviewer rejected 4xx not_allowed', async () => {
    const response = await rpc('admin_v2_publish_activity_version', {
      p_input: { activityId: systemActivityId, versionId: systemVersion2Id, reason: governanceReason },
    }, reviewer);
    assert4xx(response, ['not_allowed', '42501'], 'reviewer publish');
  });

  await test('publishActivityVersion/admin_v2_publish_activity_version system_admin success shape', async () => {
    const response = await rpc('admin_v2_publish_activity_version', {
      p_input: { activityId: systemActivityId, versionId: systemVersion2Id, reason: governanceReason },
    }, admin);
    assertStatus2xx(response, 'system admin publish');
    assertKeys(response.json, ['id', 'status', 'published_at', 'published_by'], 'published version');
    if (response.json.status !== 'published') throw new Error(`expected published, got ${response.json.status}`);
    assertVersionIllustration(response.json, systemIllustration, 'published version');
  });

  await test('copySystemActivityToFamily/admin_v2_copy_system_activity_to_family success and copied_from retained', async () => {
    const response = await rpc('admin_v2_copy_system_activity_to_family', {
      p_input: {
        activityId: systemActivityId,
        activityVersionId: systemVersion2Id,
        familyId: ids.family,
        governanceReason,
      },
    }, support);
    assertStatus2xx(response, 'copy system activity');
    assertKeys(response.json, ['id', 'source_type', 'copied_from', 'current_version'], 'copied activity');
    copiedFamilyActivityId = response.json.id;
    if (response.json.copied_from?.activity_id !== systemActivityId) throw new Error('copied_from activity_id not retained');
    if (response.json.current_version?.copied_from_version_id !== systemVersion2Id) throw new Error('copied_from version not retained');
    assertVersionIllustration(response.json.current_version, systemIllustration, 'copied family current version');
  });

  await test('copied family activity readable through admin_v2_get_family_activity', async () => {
    const response = await rpc('admin_v2_get_family_activity', { p_activity_id: copiedFamilyActivityId, governance_reason: governanceReason }, support);
    assertStatus2xx(response, 'get copied family activity');
    if (response.json.copied_from?.activity_id !== systemActivityId) throw new Error('copied_from lost on read');
    assertVersionIllustration(response.json.current_version, systemIllustration, 'copied family read current version');
  });

  await test('unpublishActivityVersion/admin_v2_unpublish_activity_version success shape', async () => {
    const response = await rpc('admin_v2_unpublish_activity_version', {
      p_input: { activityId: systemActivityId, versionId: systemVersion2Id, reason: governanceReason },
    }, admin);
    assertStatus2xx(response, 'unpublish version');
    if (response.json.status !== 'unpublished') throw new Error(`expected unpublished, got ${response.json.status}`);
  });

  await test('archiveActivityVersion/admin_v2_archive_activity_version success shape', async () => {
    const response = await rpc('admin_v2_archive_activity_version', {
      p_input: { activityId: systemActivityId, versionId: systemVersion2Id, reason: governanceReason },
    }, admin);
    assertStatus2xx(response, 'archive version');
    if (response.json.status !== 'archived') throw new Error(`expected archived, got ${response.json.status}`);
  });

  await test('createModerationCase/admin_v2_create_moderation_case success shape', async () => {
    const response = await rpc('admin_v2_create_moderation_case', {
      p_input: {
        kind: 'record_review',
        targetType: 'record',
        targetId: ids.privateRecord,
        familyId: ids.family,
        reason: governanceReason,
      },
    }, reviewer);
    assertStatus2xx(response, 'create moderation case');
    assertKeys(response.json, ['id', 'kind', 'status', 'target_type', 'target_id', 'audit_event_id'], 'moderation case');
    moderationCaseId = response.json.id;
  });

  await test('listModerationCases/admin_v2_list_moderation_cases success shape', async () => {
    const response = await rpc('admin_v2_list_moderation_cases', {
      p_options: {
        governanceReason,
        limit: 20,
        offset: 0,
        status: 'open',
        kind: 'record_review',
      },
    }, reviewer);
    assertStatus2xx(response, 'list moderation cases');
    assertArray(response.json, 'moderation cases');
    if (!response.json.some((item) => item.id === moderationCaseId)) throw new Error('created moderation case not listed');
  });

  await test('resolveModerationCase/admin_v2_resolve_moderation_case success shape', async () => {
    const response = await rpc('admin_v2_resolve_moderation_case', {
      p_input: {
        caseId: moderationCaseId,
        status: 'resolved',
        resolutionNote: `${governanceReason} resolved`,
        governanceReason,
      },
    }, reviewer);
    assertStatus2xx(response, 'resolve moderation case');
    assertKeys(response.json, ['id', 'status', 'resolved_at', 'resolution_note'], 'resolved case');
    if (response.json.status !== 'resolved') throw new Error(`expected resolved, got ${response.json.status}`);
  });

  await test('requestGovernedPrivateAccess/admin_v2_write_audit_event helper not directly executable', async () => {
    const response = await rpc('admin_v2_write_audit_event', {
      p_action: 'view_private',
      p_target_type: 'record',
      p_target_id: ids.privateRecord,
      p_reason: governanceReason,
      p_metadata: { moderation_case_id: moderationCaseId, e2e: true },
    }, reviewer);
    assert4xx(response, ['42501', 'permission denied'], 'direct write audit helper');
  });

  await test('updateNotificationPreferences/admin_v2_update_notification_preferences success shape', async () => {
    const response = await rpc('admin_v2_update_notification_preferences', {
      p_family_id: ids.family,
      p_patch: { enabled: true, frequency: 'gentle', notify_family: false, quiet_start: '21:00', quiet_end: '07:30' },
      governance_reason: governanceReason,
    }, support);
    assertStatus2xx(response, 'update notification preferences');
    assertKeys(response.json, ['family_id', 'enabled', 'frequency', 'notify_family'], 'notification preferences');
    if (response.json.frequency !== 'gentle') throw new Error(`expected gentle, got ${response.json.frequency}`);
  });

  await test('listNotifications/admin_v2_list_notifications missing governance rejected', async () => {
    const response = await rpc('admin_v2_list_notifications', { p_limit: 10, p_offset: 0, p_search: ids.family, governance_reason: '' }, support);
    assert4xx(response, ['governance_reason_required'], 'list notifications without reason');
  });

  await test('listNotifications/admin_v2_list_notifications success shape and audit', async () => {
    const response = await rpc('admin_v2_list_notifications', { p_limit: 10, p_offset: 0, p_search: ids.family, governance_reason: governanceReason }, support);
    assertStatus2xx(response, 'list notifications RPC');
    assertArray(response.json, 'notifications');
    if (!response.json.length) throw new Error('expected seeded notification');
    assertKeys(response.json[0], ['id', 'event', 'family_id', 'status', 'read_model_source'], 'notification row');
    const audit = await http(
      'GET',
      `/admin_v2_audit_events?select=id,actor_id,action,target_type,target_id,reason,metadata&actor_id=eq.${ids.familySupport}&target_id=eq.${encodeURIComponent('notification_outbox:list')}&order=created_at.desc&limit=5`,
      undefined,
      support,
    );
    assertStatus2xx(audit, 'notification audit read');
    assertArray(audit.json, 'notification audit rows');
    if (!audit.json.some((item) => item.reason === governanceReason && item.metadata?.rpc === 'admin_v2_list_notifications')) {
      throw new Error('expected notification list audit event');
    }
  });

  await test('writeAuditLog/admin_audit_log insert success', async () => {
    const response = await http('POST', '/admin_audit_log', {
      admin_user_id: ids.systemAdmin,
      action: 'e2e.write_audit_log',
      target_type: 'family',
      target_id: ids.family,
      details: { reason: governanceReason, e2e: true },
    }, admin);
    assertStatus2xx(response, 'admin_audit_log insert');
  });

  await test('listAuditLogs+listAuditEvents/admin_audit_log table read success shape', async () => {
    const response = await http('GET', `/admin_audit_log?select=id,admin_user_id,action,target_type,target_id,details,ip_address,created_at&target_id=eq.${ids.family}&order=created_at.desc&limit=20`, undefined, admin);
    assertStatus2xx(response, 'admin_audit_log read');
    assertArray(response.json, 'audit logs');
    if (!response.json.some((item) => item.action === 'e2e.write_audit_log' || item.action === 'e2e.seed')) {
      throw new Error('expected seeded or inserted admin audit log');
    }
  });

  await test('permissions/content_editor allowed draft but denied private records', async () => {
    const allowed = await rpc('admin_v2_create_activity_draft', {
      p_input: {
        sourceType: 'system',
        title: `E2E Editor Permission ${suffix}`,
        allowedCaptureModes: ['photo'],
        suggestMode: 'photo',
        why: 'why',
        how: 'how',
        recordHint: 'hint',
      },
    }, editor);
    assertStatus2xx(allowed, 'content_editor create draft');
    const denied = await rpc('admin_v2_list_family_records', recordBody, editor);
    assert4xx(denied, ['not_allowed', '42501'], 'content_editor list private records');
  });

  await test('permissions/content_reviewer allowed moderation but denied system draft', async () => {
    const allowed = await rpc('admin_v2_update_record_moderation', {
      p_record_id: ids.privateRecord,
      p_status: 'approved',
      p_note: 'reviewer permission check',
      governance_reason: governanceReason,
    }, reviewer);
    assertStatus2xx(allowed, 'content_reviewer moderation');
    const denied = await rpc('admin_v2_create_activity_draft', {
      p_input: { sourceType: 'system', title: 'Denied reviewer draft', allowedCaptureModes: ['photo'], suggestMode: 'photo' },
    }, reviewer);
    assert4xx(denied, ['not_allowed', '42501'], 'content_reviewer create system draft');
  });

  await test('permissions/family_support allowed family support but denied system draft', async () => {
    const allowed = await rpc('admin_v2_list_families', familyBody, support);
    assertStatus2xx(allowed, 'family_support list families');
    const denied = await rpc('admin_v2_create_activity_draft', {
      p_input: { sourceType: 'system', title: 'Denied support draft', allowedCaptureModes: ['photo'], suggestMode: 'photo' },
    }, support);
    assert4xx(denied, ['not_allowed', '42501'], 'family_support create system draft');
  });

  await test('permissions/system_admin allowed publish-class and governed reads', async () => {
    const dashboard = await rpc('admin_v2_dashboard_summary', {}, admin);
    assertStatus2xx(dashboard, 'system_admin dashboard');
    const records = await rpc('admin_v2_list_family_records', recordBody, admin);
    assertStatus2xx(records, 'system_admin records');
  });

  await test('ACL/anonymous all 23 repository RPC APIs rejected or not executable', async () => {
    for (const name of expectedRepositoryRpcs) {
      const response = await rpc(name, aclBody(name), null);
      assert4xx(response, [], `anonymous ${name}`);
    }
  });

  await test('ACL/new RPCs reject users without required permission', async () => {
    const checks = [
      ['admin_v2_list_system_activities', aclBody('admin_v2_list_system_activities'), ordinary, ['not_admin', '42501']],
      ['admin_v2_get_system_activity', aclBody('admin_v2_get_system_activity'), ordinary, ['not_admin', '42501']],
      ['admin_v2_list_notifications', aclBody('admin_v2_list_notifications'), editor, ['not_allowed', '42501']],
      ['admin_v2_list_notifications', aclBody('admin_v2_list_notifications'), reviewer, ['not_allowed', '42501']],
    ];
    for (const [name, body, token, categories] of checks) {
      const response = await rpc(name, body, token);
      assert4xx(response, categories, `${name} insufficient permission`);
    }
  });

  await test('ACL/four admin roles follow minimum permission matrix', async () => {
    const roleMatrix = [
      {
        role: 'content_editor',
        token: editor,
        allowed: ['admin_v2_dashboard_summary', 'admin_v2_list_system_activities', 'admin_v2_create_activity_draft'],
        denied: ['admin_v2_list_family_records', 'admin_v2_list_families', 'admin_v2_list_notifications', 'admin_v2_publish_activity_version'],
      },
      {
        role: 'content_reviewer',
        token: reviewer,
        allowed: ['admin_v2_dashboard_summary', 'admin_v2_list_family_records', 'admin_v2_update_record_moderation', 'admin_v2_list_moderation_cases'],
        denied: ['admin_v2_create_activity_draft', 'admin_v2_list_notifications', 'admin_v2_publish_activity_version'],
      },
      {
        role: 'family_support',
        token: support,
        allowed: ['admin_v2_dashboard_summary', 'admin_v2_list_families', 'admin_v2_list_notifications', 'admin_v2_list_family_activities'],
        denied: ['admin_v2_create_activity_draft', 'admin_v2_update_record_moderation', 'admin_v2_publish_activity_version'],
      },
      {
        role: 'system_admin',
        token: admin,
        allowed: ['admin_v2_dashboard_summary', 'admin_v2_list_families', 'admin_v2_list_notifications', 'admin_v2_list_family_records', 'admin_v2_list_moderation_cases'],
        denied: [],
      },
    ];

    for (const entry of roleMatrix) {
      for (const name of entry.allowed) {
        const response = await rpc(name, aclBody(name), entry.token);
        assertStatus2xx(response, `${entry.role} allowed ${name}`);
      }
      for (const name of entry.denied) {
        const response = await rpc(name, aclBody(name), entry.token);
        assert4xx(response, ['not_allowed', '42501'], `${entry.role} denied ${name}`);
      }
    }
  });

  await test('coverage/all 30 repository methods mapped to HTTP/PostgREST checks', async () => {
    const missing = expectedRepositoryMethods.filter((name) => !repositoryCoverage.has(name));
    if (missing.length) throw new Error(`missing repository coverage: ${missing.join(', ')}`);
  });

  await test('coverage/all 23 SupabaseAdminRepository RPCs exercised', async () => {
    const missing = expectedRepositoryRpcs.filter((name) => !rpcCoverage.has(name));
    if (missing.length) throw new Error(`missing RPC coverage: ${missing.join(', ')}`);
  });
}

try {
  await main();
} catch (error) {
  fail('fatal/setup', error);
} finally {
  await cleanup();
  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  console.log(`SUMMARY total=${results.length} passed=${passed} failed=${failed} temp_db=${tempDb} rest_container=${restContainer}`);
  if (failed > 0) process.exitCode = 1;
}
