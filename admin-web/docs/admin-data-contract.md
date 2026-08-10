# Admin data contract

This admin web package uses the browser Supabase client only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The frontend must never receive or embed `service_role`. Admin access is proven by a normal Supabase Auth session whose own `public.profiles.admin_role` is one of:

- `super_admin`
- `admin`
- `operator`
- `support`

If either env var is missing, or the browser client cannot restore/connect to Supabase, `createAdminRepository()` returns an explicit demo repository with `mode: "demo"` and a human-readable `reason`.

## Client exports

- `src/lib/admin/supabase.ts`
  - `getAdminSupabaseClient()`
  - `hasSupabaseConfig()`
  - `getSupabaseConfigStatus()`
- `src/lib/admin/repository.ts`
  - `createAdminRepository()` returns live or demo repository.
  - `createLiveAdminRepository()` requires Supabase config and throws if missing.
- `src/lib/admin/types.ts`
  - `AdminRepository`
  - `AdminRole`
  - dashboard/users/families/memories/notifications/audit row types.
- `src/features/auth`
  - `AdminAuthProvider`
  - `useAdminAuth()`
  - `signInAdminWithPassword()`
  - `restoreAdminSession()`
  - `signOutAdmin()`

## Live repository coverage

The live repository reads these database objects through the anon-authenticated user session:

- Dashboard
  - Counts: `profiles`, `families`, `kids`, `memories`, `memories.moderation_status = pending`, `notification_outbox`.
  - Daily series: `mv_daily_stats`, `mv_daily_users`.
- Users
  - Reads `profiles`.
  - Exposes profile fields only; it does not read `auth.users`.
- Families
  - Reads `families`.
- Memories
  - Reads `memories`.
- Content review
  - Reads `memories`.
  - Updates only `memories.moderation_status` and `memories.moderation_note`.
  - Writes `admin_audit_log` after moderation updates.
- Notifications
  - Reads `notification_outbox`.
  - Updates `notification_preferences` by `family_id`.
  - Writes `admin_audit_log` after preference updates.
- Audit
  - Reads and writes `admin_audit_log`.

## Required backend policy

Current migrations add `profiles.admin_role`, content moderation columns, and `admin_audit_log`, but they do not define admin-wide RLS policies or admin RPCs for every table above.

For production live data, Supabase must add server-side policies or `SECURITY DEFINER` RPCs that:

- Check `auth.uid()` against `profiles.admin_role`.
- Grant read access to the admin views/tables needed by the dashboard.
- Grant narrow write access for moderation and notification preference updates.
- Grant audit log insertion where `admin_user_id = auth.uid()`.

Without those policies, the live repository fails with `AdminDataError` code `admin_permission_denied`. This is intentional: the frontend must not pretend the anon key has administrator powers.

## Demo mode

Demo mode is used only when configuration is missing or the client is unreachable during repository creation. Demo rows use `example.invalid` addresses and deterministic IDs. UI code should surface `repository.mode` and `repository.reason` so operators can tell they are not viewing live data.
