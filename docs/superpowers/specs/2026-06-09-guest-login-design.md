# Guest Login (游客登录) Design Spec

## Overview

Add guest login support so users can fully experience the app without registering first. Guest data persists server-side and seamlessly transfers when the user binds a real account.

## Approach

Use Supabase's native `signInAnonymously()`. This creates a real anonymous user with a valid `auth.uid()`, so existing RLS policies work without modification. The upgrade path (`updateUser`) is built into Supabase — the user ID stays the same, all data is preserved.

## 1. Auth Layer (`src/lib/auth.ts`)

Add two functions:

- **`signInAnonymously()`** — calls `supabase.auth.signInAnonymously()`, returns session data, throws on error.
- **`isAnonymous()`** — calls `supabase.auth.getUser()`, returns `user.is_anonymous` boolean.

### Supabase backend config

Enable anonymous sign-ins in `supabase-docker/.env`:

```
ENABLE_ANONYMOUS_USERS=true
```

(docker-compose.yml maps this to `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED` automatically.)

### Impact on existing code

None. `AuthGate` in `App.tsx` already handles any valid session via `onAuthStateChange`. An anonymous session sets `userId` the same way, and `DataProvider` receives it normally.

## 2. LoginWelcome UI (`src/screens/Login.tsx`)

Add a "先逛逛再说" button in `LoginWelcome`, positioned between the "本机号码一键登录" button and the agreement checkbox row.

### Button spec

- **Style:** Secondary — transparent background, `theme.accent` text, thin border (`theme.line`). Visually subordinate to the primary one-click login button.
- **Label:** "先逛逛再说"
- **Behavior:** Call `signInAnonymously()` → on success, `navigation.replace('Home')`. On failure, `Alert.alert` with a network error message.
- **Agreement gate:** Button is disabled (grayed out) when `agreed` is `false`, same as the one-click login button.

### After login

The guest user goes through the normal onboarding flow (choose role, add child). This makes their data real from the start, so binding an account later is seamless.

## 3. Settings — Guest Status & Bind Entry

### Settings main page (`Settings` component)

In the "账户" group, when the user is anonymous, the "账户与安全" row shows `value="游客"` in `theme.accent` color. For normal users, no change.

### AccountSecuritySheet changes

Detect anonymous status via `isAnonymous()` (called once on mount, stored in local state).

**When anonymous:**

- **Top description** changes to: "你目前是游客身份。绑定手机号或邮箱后，回忆就不会丢失。"
- **"登录方式" group** shows:
  - Phone row: title "手机号", value "未绑定", opens `ChangePhoneSheet` (reused; the "当前号码" row at the top is hidden when the user has no phone bound. SMS verification is not yet wired to backend.)
  - WeChat row: title "微信", value "未绑定" (non-functional, same as current)
  - **New email row:** title "邮箱", value "未绑定", opens `BindEmailSheet` (new)
- **"退出登录"** row: kept. Logging out as a guest means the anonymous session is lost; next anonymous login creates a new user. This is expected behavior.
- **"注销账户"** row: kept, unchanged.

**When not anonymous:** No changes at all.

## 4. BindEmailSheet (new, inside `Settings.tsx`)

A modal sheet for binding an email + password to the anonymous account.

### UI

Follows the same layout pattern as `ChangePhoneSheet`:

- `LayerHeader` with title "绑定邮箱" and a "绑定" save button (top-right)
- Email text input
- Password text input (min 6 chars)
- Save button enabled when email is valid and password >= 6 chars

### Behavior

- Calls `supabase.auth.updateUser({ email, password })`.
- On success: close sheet. The `is_anonymous` flag becomes `false` automatically. The AccountSecuritySheet re-reads anonymous status and updates to the normal (non-guest) view.
- On failure: `Alert.alert` with the error message.

### Why not reuse EmailLogin?

- `EmailLogin` has login/register mode toggle — not needed for binding.
- `EmailLogin` navigates to Home on success — binding should close the sheet and stay in Settings.
- The API call is different: `updateUser` vs `signUp`/`signIn`.

## 5. Files Changed

| File | Change |
|------|--------|
| `src/lib/auth.ts` | Add `signInAnonymously()`, `isAnonymous()` |
| `src/screens/Login.tsx` | Add "先逛逛再说" button in `LoginWelcome` |
| `src/screens/Settings.tsx` | Guest badge in Settings main, conditional UI in `AccountSecuritySheet`, new `BindEmailSheet` |
| `supabase-docker/.env` | Enable `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true` |

## 6. What Does NOT Change

- **RLS policies** — anonymous users have a real `auth.uid()`, all policies work as-is.
- **DataProvider / data layer** — receives `userId` from `AuthGate` like any other user.
- **Onboarding flow** — guests go through role selection and child setup normally.
- **Navigation** — no new screens or routes. `BindEmailSheet` is a modal inside Settings.
- **Other login methods** — email login, phone login, social login all untouched.
