# Database Domain Audit

Scope: audit of Supabase schema, migrations, seed data, SQL snippets, generated types, and application data access for the `事情 - 家庭 - 孩子 - 记录` domain.

This document only records findings. It does not modify schema or code.

## Executive Summary

The current backend is not a single normalized content model. It is a hybrid of:

1. A real family-shared content store centered on `families`, `family_members`, `kids`, `memories`, `custom_levels`, and `invite_tokens`.
2. A static catalog in `public.levels` and `public.wardrobe`.
3. A notification subsystem built around `notification_outbox`, `notification_templates`, `notification_log`, and `notification_preferences`.
4. An admin overlay that adds moderation and audit concepts on top of `memories`, but does not fully align with the rest of the schema.

The core domain model exists, but it is split across:

- `supabase-docker/volumes/db/init/schema.sql`
- `supabase-docker/volumes/db/init/seed.sql`
- `supabase-docker/migrations/*.sql`
- `supabase-docker/volumes/snippets/*.sql`
- app data access in `src/data/index.ts` and `src/data/DataProvider.tsx`
- admin access in `admin-web/src/lib/admin/*.ts`

The biggest structural issue is that "事情" is represented by at least three different shapes:

- system catalog rows in `public.levels`
- family-authored rows in `public.custom_levels`
- invite-web payload snapshots in `public.invite_tokens`

Those three shapes overlap heavily but are not normalized into a single base entity plus revisions/instances/completions. Records are also split: `public.memories` is the only persistent completion record, but it still embeds both the task reference and the completion payload.

## What Exists Today

### 1) Family identity and membership are real backend entities

Evidence:

- `public.families` and `public.family_members` in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- family context helpers `public.my_family_id()` and `public.is_family_creator(fid uuid)` in the same file
- family creation/join RPCs `public.create_family(...)`, `public.redeem_invite(...)`, `public.peek_invite(...)`, and `public.family_roster()` in the same file
- app reads family membership in [`src/data/index.ts`](../../src/data/index.ts) via `getMyFamilyId()`, `fetchMyFamily()`, `createFamily()`, `joinFamily()`, `leaveFamily()`, `removeFamilyMember()`

Observed model:

- `families` is the shared household container.
- `family_members` is the roster and membership authority.
- `created_by` defines the creator/owner.
- `role` and `custom_role` are stored per member, not just per profile.

Ownership rule:

- A user can belong to at most one family at a time, enforced in `create_family()` and `redeem_invite()`.
- Creator privileges are checked via `is_family_creator()`.
- If the creator deletes their account, `delete_own_account()` transfers `created_by` to the earliest other member when possible.

### 2) Kids are first-class shared family entities

Evidence:

- `public.kids` in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- `delete_kid(p_kid_id text)` RPC in the same file
- `delete_kid` migration references in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql) and app call in [`src/data/index.ts`](../../src/data/index.ts)

Observed columns:

- `id`, `family_id`, `user_id`
- `name`, `birth_year`, `birth_month`
- `tone`, `bear`, `since`, `accessories`

Meaning:

- `family_id` makes kids shared within a family.
- `user_id` is attribution for who created the child row.
- `delete_kid()` is creator-only and cascades manual cleanup to `memories`, `mascots`, and `invite_tokens`.

### 3) Memories are the persistent record layer

Evidence:

- `public.memories` in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- `moderation_status` and `moderation_note` added in [`supabase-docker/migrations/20260703_phase2.sql`](../../supabase-docker/migrations/20260703_phase2.sql)
- app insert/delete/read paths in [`src/data/index.ts`](../../src/data/index.ts)
- admin list/update paths in [`admin-web/src/lib/admin/supabaseRepository.ts`](../../admin-web/src/lib/admin/supabaseRepository.ts)

Observed columns:

- identity and ownership: `id`, `family_id`, `user_id`, `kid_id`
- content reference: `level_num`, `perspective`, `type`
- metadata: `duration`, `shots`, `date`, `place`, `title`, `caption`, `transcript`, `tone`
- sealing: `sealed`, `seal_until`, `seal_label`
- invite provenance: `invite_token_id`, `invited_role`
- moderation: `moderation_status`, `moderation_note`
- audit timestamp: `created_at`

This is the most important table in the product. It is both:

- the user-visible record/completion log
- the anchor for notifications, moderation, and admin workflows

### 4) The system catalog of "事情" exists in `public.levels`

Evidence:

- table definition in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- canonical rows in [`supabase-docker/volumes/db/init/seed.sql`](../../supabase-docker/volumes/db/init/seed.sql)
- repeated catalog loading in [`src/data/index.ts`](../../src/data/index.ts) via `fetchLevelsByNums()` and `fetchRecommendedLevels()`

Observed columns:

- `num` primary key
- `perspective`, `tone`, `title`
- content fields: `why`, `how`, `record`
- suggestion and lifecycle: `suggest`, `sealed`, `seal_until`, `sealed_on`, `seal_kind`
- merchandising/context: `seasonal`, `kid`, `sort_order`
- illustration: `illustration_path`

Seed data confirms the model is editorial content, not user-generated content:

- `seed.sql` contains a curated list of 21 rows with human-written copy and fixed sort order.
- row `12` is sealed with `seal_kind = 'age18'`.
- row `04` is sealed with a concrete date.
- row `15` is seasonal.

### 5) Family custom "事情" exist, but as a separate table

Evidence:

- `public.custom_levels` in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- app create/edit/delete flow in [`src/data/index.ts`](../../src/data/index.ts)
- realtime publication coverage in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)

Observed columns:

- `id` serial primary key
- `family_id`, `user_id`
- `num`
- `title`, `why`, `how`, `record_hint`
- `perspective`, `tone`, `suggest`
- `illustration_path`
- `recurring`, `spot_note`, `reminder_text`
- `created_at`

Observed behavior:

- app assigns `num` as `★N`
- `user_id` is attribution, `family_id` is ownership
- update/delete are family-scoped by RLS
- delete path best-effort removes the corresponding illustration object

### 6) Invite-web payloads snapshot the content model

Evidence:

- `public.invite_tokens` in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- extra columns added in the same file
- `yaoji` edge function and browser UI code in [`supabase-docker/volumes/functions/yaoji/index.ts`](../../supabase-docker/volumes/functions/yaoji/index.ts)

Observed columns:

- family and creator linkage: `family_id`, `created_by`
- content snapshot: `level_num`, `level_title`, `level_why`, `level_how`, `level_record`, `level_suggest`, `level_tone`, `perspective`
- child snapshot: `kid_id`, `kid_name`
- inviter metadata: `inviter_role`
- media: `illustration_path`
- lifecycle: `expires_at`, `opened_at`, `is_active`, `created_at`

This is a distribution payload, not the primary source of truth.

### 7) Media storage is already split by content type and ownership

Evidence:

- `memories` bucket policy and `illustrations` bucket policy in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- media helper in [`src/lib/media.ts`](../../src/lib/media.ts)
- upload helper in [`src/data/index.ts`](../../src/data/index.ts)

Observed rules:

- memory media lives in private bucket `memories`
- object path shape is `${familyId}/${memoryId}/<name>`
- illustration media lives in public bucket `illustrations`
- illustration write access is family-scoped by folder prefix
- app reads memory media via signed URLs

`src/lib/media.ts` also shows runtime file-type classification:

- video extensions: `mp4`, `mov`, `m4v`, `3gp`, `webm`
- audio extensions: `m4a`, `caf`, `wav`, `mp3`, `aac`, `ogg`
- image is the fallback
- live photo pairs are recognized by `.live.<ext>`

### 8) Notification and audit infrastructure exists

Evidence:

- `notification_templates`, `notification_log`, `notification_preferences`, `push_devices` in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- transactional outbox in [`supabase-docker/migrations/20260702_notification_outbox.sql`](../../supabase-docker/migrations/20260702_notification_outbox.sql)
- notification custom-level integration in [`supabase-docker/migrations/20260702_custom_level_notify.sql`](../../supabase-docker/migrations/20260702_custom_level_notify.sql)
- admin moderation/audit in [`supabase-docker/migrations/20260703_phase2.sql`](../../supabase-docker/migrations/20260703_phase2.sql)
- admin role in [`supabase-docker/migrations/20260703_admin_role.sql`](../../supabase-docker/migrations/20260703_admin_role.sql)
- stats views in [`supabase-docker/migrations/20260703_phase3.sql`](../../supabase-docker/migrations/20260703_phase3.sql)

Observed capabilities:

- family-scoped notification preferences
- delivery template lookup by scene/species/lang/sort order
- notification log with click tracking hooks
- outbox-based retry and cron drain
- admin audit log table
- moderation workflow fields on memories
- admin role field on profiles

## What Is Only Partially Modeled

### 1) The content hierarchy is not normalized

Current shape:

- `levels` for system catalog content
- `custom_levels` for family content
- `invite_tokens` for transient sharing snapshots
- `memories` for records/completions

What is missing:

- a single canonical `activities` or `things` table
- a versioned `activity_revisions` or equivalent
- a distinct `activity_instances` / `completion_records` table
- a join table from records to shared templates that survives catalog revisioning cleanly

Result:

- system and custom content are close in shape but are stored separately
- invite payloads duplicate content fields instead of referencing them
- record rows mix semantic content, media/completion metadata, and moderation state

### 2) Ownership and editability are only partly explicit

Current rules:

- `families.created_by` defines creator-level delete/update authority.
- `family_members` holds shared membership.
- `custom_levels` and `kids` are family-scoped through RLS.
- `memories` are family-scoped and any member can write/delete under the current policy.

Gaps:

- There is no column that explicitly encodes "this is editable by all members", "creator-only", "system-only", or "published read-only".
- `profiles.role/custom_role` are mirrored into `family_members.role/custom_role`, which creates dual sources of truth.
- admin intent is not expressed as an RLS policy matrix; it is implied by service role usage or manual access.

### 3) Records support multiple capture modes, but the model is under-specified

Current evidence:

- `memories.type` is constrained to `voice/photo/text/video` in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- `src/lib/media.ts` supports image/video/audio file types and live photo pairing
- `src/data/index.ts` writes `duration`, `shots`, `caption`, `transcript`, `seal_until`, and `seal_label`

What is missing:

- a normalized media table
- explicit per-record media constraints by type
- explicit validation for which `memories.type` can carry which payloads
- record-level authoring affordances beyond generic columns

### 4) Localization is mostly static, not a backend contract

Current evidence:

- `levels` stores Chinese editorial text in seed data
- `notification_templates` has `lang`
- `src/data/index.ts` and `src/lib/media.ts` are language-aware at runtime

What is missing:

- a normalized i18n table for `levels`
- a translation/version strategy for user-authored `custom_levels`
- a backend notion of locale variants for seed catalog content

### 5) Admin access exists, but the backend contract is incomplete

Current evidence:

- `public.profiles.admin_role` added by [`supabase-docker/migrations/20260703_admin_role.sql`](../../supabase-docker/migrations/20260703_admin_role.sql)
- `admin_audit_log` and `moderation_*` columns added by [`supabase-docker/migrations/20260703_phase2.sql`](../../supabase-docker/migrations/20260703_phase2.sql)
- admin web directly reads `profiles`, `families`, `memories`, `notification_outbox`, `admin_audit_log`, `notification_preferences`, and the materialized views in [`admin-web/src/lib/admin/supabaseRepository.ts`](../../admin-web/src/lib/admin/supabaseRepository.ts)

What is missing:

- a documented admin RLS policy set
- dedicated admin RPCs for moderation, user lookup, content review, and family support actions
- a stable admin-safe projection of family/private data

## What Is Static App Data Only

### 1) Wardrobe

Evidence:

- `public.wardrobe` exists in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- it is seeded in [`supabase-docker/volumes/db/init/seed.sql`](../../supabase-docker/volumes/db/init/seed.sql)

Interpretation:

- this is a public read-only decorative catalog
- it is not part of the family content lifecycle

### 2) Many display rules live only in TypeScript helpers

Evidence:

- `REPEATABLE_LEVELS` in [`src/data/index.ts`](../../src/data/index.ts)
- `suitsNow()`, `kidAge()`, `memoriesForLevelFrom()`, `yearFromDate()`, etc. in the same file
- `frameLabelFrom`, `levelWeightFrom`, `weightedShuffleFrom` in the same file

Interpretation:

- some product behavior is encoded in the app, not the database
- this is fine for UI heuristics, but it means the backend does not own those rules

### 3) The media type constraint is only partly enforced by data model

Evidence:

- `memories.type` check constraint in [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- runtime media classification in [`src/lib/media.ts`](../../src/lib/media.ts)

Interpretation:

- storage and UI know more media variants than the table definition does
- the DB knows only `voice/photo/text/video`, not the actual file mix

## What Is Missing Entirely

### 1) A normalized "事情" base model

Missing components:

- canonical `activities` table
- explicit `activity_versions`
- explicit `activity_visibility` or `activity_publish_state`
- explicit `activity_owner_scope`

### 2) A normalized record/completion model

Missing components:

- `records` as a first-class completion table separate from task definition
- per-record media attachments table
- structured validation for capture mode and payload shape

### 3) Explicit published/revision lifecycle

Missing components:

- publish/unpublish versioning for system content
- soft-delete or archive state for catalog entries
- revision history for custom family content
- versioned snapshots for invite payloads

### 4) Backend-enforced content governance

Missing components:

- admin-only moderation RPCs
- creator-only edit policies for family-authored content where needed
- clear read policy for unpublished family content versus shared family content
- audit entries for sensitive mutations across all family content tables

### 5) Localized catalog management

Missing components:

- translation rows for `levels`
- locale fallback logic in the database layer
- publish status per locale

## Key Schema Facts by Domain

### System "事情" (`public.levels`)

Evidence:

- [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- [`supabase-docker/volumes/db/init/seed.sql`](../../supabase-docker/volumes/db/init/seed.sql)

Facts:

- read-only public catalog
- has editorial copy fields: `why`, `how`, `record`
- supports action suggestion via `suggest`
- supports sealed experiences via `sealed`, `seal_until`, `sealed_on`, `seal_kind`
- supports seasonal tagging and sort order
- supports illustration path

### Family custom "事情" (`public.custom_levels`)

Evidence:

- [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- [`src/data/index.ts`](../../src/data/index.ts)

Facts:

- one row belongs to one family
- creator attribution exists via `user_id`
- title/why/how/record_hint are stored directly on the row
- has its own illustration path
- has recurrence and reminder metadata

### Record/completion (`public.memories`)

Evidence:

- [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- [`src/data/index.ts`](../../src/data/index.ts)
- [`src/lib/media.ts`](../../src/lib/media.ts)

Facts:

- one row belongs to one family and one kid
- one row references one catalog/custom level by `level_num`
- supports text, photo, voice, and video at the record level
- supports transcript, duration, shots, place, title, caption
- supports sealing
- supports invite provenance
- stores moderation state

### Invite flow (`public.invite_tokens`)

Evidence:

- [`supabase-docker/volumes/db/init/schema.sql`](../../supabase-docker/volumes/db/init/schema.sql)
- [`supabase-docker/volumes/functions/yaoji/index.ts`](../../supabase-docker/volumes/functions/yaoji/index.ts)

Facts:

- stores a transient snapshot of a thing plus child context
- is family-scoped and expires
- can be opened once and deactivated

## RLS, Audit, and Admin

### RLS coverage

Strong:

- `profiles` owner-only access
- `families` family-read with creator updates/deletes
- `family_members` family-read with creator removal
- `kids` family-scoped access with creator delete
- `memories` family-scoped full access
- `mascots` family-scoped full access
- `custom_levels` family-scoped full access
- `invite_tokens` family-scoped full access
- `notification_preferences` family-scoped full access
- `notification_log` family-scoped full access
- `push_devices` owner-only access
- storage bucket policies for `memories` and `illustrations`

Weak or absent:

- no explicit RLS policies on `notification_outbox` beyond deny-by-default
- no explicit RLS policy set for admin moderation workflows
- no explicit admin override projection for private family tables

### Audit

Existing:

- `admin_audit_log` table in [`supabase-docker/migrations/20260703_phase2.sql`](../../supabase-docker/migrations/20260703_phase2.sql)
- admin web writes audit rows after memory moderation and notification preference updates in [`admin-web/src/lib/admin/supabaseRepository.ts`](../../admin-web/src/lib/admin/supabaseRepository.ts)

Missing:

- automatic audit triggers for all sensitive content mutations
- audit coverage for role changes, deletions, publication changes, and family membership changes

### Admin capabilities

Existing:

- list users, families, memories, notifications, audit logs in [`admin-web/src/lib/admin/supabaseRepository.ts`](../../admin-web/src/lib/admin/supabaseRepository.ts)
- update memory moderation status and note
- update notification preferences

Missing:

- admin-safe family inspection RPCs
- admin-safe content publish/unpublish/archive RPCs
- admin-safe membership and deletion actions with first-class audit trails

## Recommendation: Normalized Model

The recommended target model should separate definition, version, and completion:

### A) Activity definition

Suggested canonical entity:

- `activities`

Suggested fields:

- `id`
- `scope` or `owner_type`/`owner_id`
- `source_type` (`system` / `family`)
- `source_key` for stable catalog identity
- `title`
- `status` (`draft`, `published`, `archived`, `deleted`)
- `visibility` (`public`, `family`, `private`)
- `perspective`
- `category`
- `age_band` / `growth_stage`
- `sort_order`
- `published_at`
- `version_current_id`

### B) Activity revision

Suggested canonical entity:

- `activity_versions`

Suggested fields:

- `activity_id`
- `version`
- `why`
- `how`
- `record_hint`
- `suggest_mode`
- `illustration_path`
- `media_meta`
- `locale`
- `is_published`
- `created_by`
- `created_at`

This would absorb:

- `public.levels`
- `public.custom_levels`
- the snapshot fields in `invite_tokens`

### C) Completion record

Suggested canonical entity:

- `activity_records`

Suggested fields:

- `id`
- `family_id`
- `kid_id`
- `activity_id`
- `activity_version_id`
- `performed_by`
- `capture_type`
- `title`
- `caption`
- `transcript`
- `duration`
- `shots`
- `place`
- `recorded_at`
- `sealed_until`
- `seal_label`
- `moderation_status`
- `moderation_note`

Suggested attachments:

- `activity_record_media`

This would absorb:

- the payload currently embedded in `memories`
- the runtime media files under the `memories` bucket

### D) Family custom content ownership

Recommended rules:

- family custom content is family-owned by default
- creator metadata is retained separately from edit authority
- family creator can publish/archive and delete
- ordinary members can create draft content only if allowed by policy
- published family content should be read-only unless explicitly edited through a versioned flow

### E) Records and sealing

Recommended rules:

- sealing belongs on the record row, not on the base activity definition
- `seal_kind` is a definition-level rule only when it is intrinsic to the activity
- actual unlock time belongs to the record snapshot

## Migration Risk

If normalization is introduced later, the main risks are:

1. Dual-write drift between old and new tables.
2. Breaking `level_num` references in `memories`, `invite_tokens`, and app caches.
3. Breaking storage path assumptions tied to `familyId/memoryId` and family-scoped illustration folders.
4. Breaking admin tooling that currently queries tables directly with `select('*')`.
5. Realtime subscriptions that depend on current table names and `family_id` filters.

Highest-risk coupling points:

- `src/data/index.ts`
- `src/data/DataProvider.tsx`
- `admin-web/src/lib/admin/supabaseRepository.ts`
- `supabase-docker/volumes/functions/yaoji/index.ts`
- `supabase-docker/volumes/db/init/schema.sql`

## Backend Data Contract Recommendation

For the admin redesign, the backend contract should be explicit about:

1. Which tables are authoritative:
   - `families`, `family_members`, `kids`, `activities`, `activity_versions`, `activity_records`
2. Which tables are derived or transient:
   - `invite_tokens`, `notification_outbox`, materialized views
3. Which fields are editable by family members:
   - create, update, archive, delete, publish
4. Which fields are write-once:
   - record timestamps, audit log entries, immutable version snapshots
5. Which fields are admin-only:
   - moderation state, support actions, audit access, cross-family lookups
6. Which fields are locale-specific:
   - catalog copy, notification templates, and any future translations
7. Which media path rules are contractual:
   - memory media under private family/memory folders
   - illustration media under family-scoped public folders

## Final Assessment

Current status by area:

- Existing and working:
  - family identity and membership
  - kids
  - memory records
  - system catalog `levels`
  - family custom catalog `custom_levels`
  - invite-token sharing
  - media storage split
  - notification subsystem
  - moderation fields and audit log
- Partially modeled:
  - content hierarchy and versioning
  - edit permissions and publication lifecycle
  - record payload shape and media constraints
  - localization
  - admin contract
- Static app data only:
  - wardrobe
  - many recommendation/display heuristics
- Missing:
  - normalized activity/version/record schema
  - explicit admin-safe data contract
  - complete policy matrix for publish/edit/archive/delete
  - normalized translations
