# Guest Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users try the app as a guest via Supabase anonymous auth, with full functionality and a path to bind a real account later.

**Architecture:** Use Supabase's native `signInAnonymously()` to create a real anonymous user. The anonymous user gets a valid `auth.uid()`, so all existing RLS policies and data flows work unchanged. Account upgrade uses `supabase.auth.updateUser()` which preserves the user ID and all data.

**Tech Stack:** React Native (Expo 56), Supabase JS v2, React Navigation

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase-docker/.env` | Modify line 176 | Enable anonymous users |
| `src/lib/auth.ts` | Modify | Add `signInAnonymously()` and `isAnonymous()` |
| `src/screens/Login.tsx` | Modify `LoginWelcome` | Add "先逛逛再说" guest button |
| `src/screens/Settings.tsx` | Modify `AccountSecuritySheet`, `Settings`, add `BindEmailSheet` | Guest status badge, conditional account UI, email binding sheet |

---

### Task 1: Enable Anonymous Users in Supabase Config

**Files:**
- Modify: `supabase-docker/.env:176`

- [ ] **Step 1: Change the flag**

In `supabase-docker/.env`, change line 176 from:

```
ENABLE_ANONYMOUS_USERS=false
```

to:

```
ENABLE_ANONYMOUS_USERS=true
```

The docker-compose.yml already maps this to `GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED` at line 162, so no other config changes are needed.

- [ ] **Step 2: Commit**

```bash
git add supabase-docker/.env
git commit -m "feat(auth): enable anonymous users in Supabase config"
```

---

### Task 2: Add Auth Functions for Anonymous Login

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add `signInAnonymously` and `isAnonymous` to auth.ts**

Add these two functions after the existing `signOut` function (after line 18):

```typescript
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data;
}

export async function isAnonymous(): Promise<boolean> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  return user.is_anonymous === true;
}

export async function bindEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;
  return data;
}
```

`signInAnonymously` — creates an anonymous Supabase user, triggers `onAuthStateChange` which sets `userId` in `AuthGate`.

`isAnonymous` — reads the current user from Supabase and checks the `is_anonymous` flag. Returns `false` if there's no user or an error.

`bindEmail` — upgrades an anonymous user by setting email + password via `updateUser`. The user ID stays the same, `is_anonymous` becomes `false`, all data is preserved.

- [ ] **Step 2: Verify the module exports cleanly**

```bash
npx tsc --noEmit src/lib/auth.ts 2>&1 | head -20
```

Expected: no errors (or only pre-existing unrelated ones).

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): add signInAnonymously, isAnonymous, and bindEmail"
```

---

### Task 3: Add Guest Button to LoginWelcome

**Files:**
- Modify: `src/screens/Login.tsx:1-3` (imports), `src/screens/Login.tsx:165-291` (LoginWelcome component)

- [ ] **Step 1: Add `Alert` to the import and import `signInAnonymously`**

Change the import block at the top of `src/screens/Login.tsx`.

Add `Alert` to the react-native import (line 3):

```typescript
import {
  View, Text, TouchableOpacity, TextInput, Dimensions, Modal, Pressable, Alert,
} from 'react-native';
```

Add a new import after line 7:

```typescript
import { signInAnonymously } from '../lib/auth';
```

- [ ] **Step 2: Add the guest button in LoginWelcome**

In the `LoginWelcome` component, find the one-click login `TouchableOpacity` that ends at line 261 (`</TouchableOpacity>`). Insert the guest button **between** the one-click login button and the agreement row (between lines 261 and 263).

Insert this JSX after the one-click login `</TouchableOpacity>` and before `{/* Agreement */}`:

```jsx
        {/* Guest login */}
        <TouchableOpacity
          onPress={async () => {
            if (!agreed) return;
            try {
              await signInAnonymously();
              navigation.replace('Home');
            } catch (e: any) {
              Alert.alert('无法连接', '请检查网络后重试');
            }
          }}
          activeOpacity={0.8}
          style={{
            marginTop: 12,
            paddingVertical: 17,
            borderRadius: 999,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: agreed ? theme.accent : theme.line,
            alignItems: 'center',
          }}
        >
          <Text style={{
            fontFamily: theme.fonts.head,
            fontSize: 17,
            color: agreed ? theme.accent : theme.inkSoft,
          }}>先逛逛再说</Text>
        </TouchableOpacity>
```

- [ ] **Step 3: Verify no syntax errors**

```bash
npx tsc --noEmit src/screens/Login.tsx 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Login.tsx
git commit -m "feat(auth): add guest login button to LoginWelcome"
```

---

### Task 4: Add Guest Badge to Settings Main Page

**Files:**
- Modify: `src/screens/Settings.tsx:1-15` (imports), `src/screens/Settings.tsx:1703-1771` (Settings component)

- [ ] **Step 1: Add import for `isAnonymous`**

In `src/screens/Settings.tsx`, add `isAnonymous` to the existing auth import at line 14:

Change:

```typescript
import { signOut } from '../lib/auth';
```

to:

```typescript
import { signOut, isAnonymous } from '../lib/auth';
```

- [ ] **Step 2: Add anonymous state to the Settings component**

In the `Settings` component (starts at line 1703), add anonymous state detection after the existing state declarations. Find line 1724 (`const [rhythm, setRhythm] = useState('每两周');`) and add after it:

```typescript
  const [anon, setAnon] = useState(false);
  useEffect(() => { isAnonymous().then(setAnon); }, []);
```

Also add `useEffect` to the existing React import at line 4 if it's not already there. Check line 4:

```typescript
import React, { useState, useCallback, useRef } from 'react';
```

Change to:

```typescript
import React, { useState, useCallback, useRef, useEffect } from 'react';
```

- [ ] **Step 3: Pass `anon` to AccountSecuritySheet and show guest badge**

Find the "账户" SettingGroup (around line 1764). Change:

```jsx
        <SettingGroup label="账户">
          <Row
            icon={Icon.shieldCheck(theme.accent, 20)}
            title="账户与安全"
            onPress={() => setSheet('account')}
            last
          />
        </SettingGroup>
```

to:

```jsx
        <SettingGroup label="账户">
          <Row
            icon={Icon.shieldCheck(theme.accent, 20)}
            title="账户与安全"
            value={anon ? '游客' : undefined}
            onPress={() => setSheet('account')}
            last
          />
        </SettingGroup>
```

Then find the AccountSecuritySheet rendering (around line 1926):

```jsx
      {sheet === 'account' ? (
        <AccountSecuritySheet onClose={() => setSheet(null)} />
      ) : null}
```

Change to:

```jsx
      {sheet === 'account' ? (
        <AccountSecuritySheet anon={anon} onAnonChanged={() => isAnonymous().then(setAnon)} onClose={() => setSheet(null)} />
      ) : null}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/Settings.tsx
git commit -m "feat(settings): add guest badge to account row"
```

---

### Task 5: Add BindEmailSheet Component

**Files:**
- Modify: `src/screens/Settings.tsx` (add new component before AccountSecuritySheet, around line 1570)

- [ ] **Step 1: Add `bindEmail` to the auth import**

Change the auth import (modified in Task 4) from:

```typescript
import { signOut, isAnonymous } from '../lib/auth';
```

to:

```typescript
import { signOut, isAnonymous, bindEmail } from '../lib/auth';
```

- [ ] **Step 2: Add the `Alert` import**

Check the react-native import at line 6. Add `Alert` if not present:

```typescript
import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  Modal, Pressable, TextInput, StyleSheet, Dimensions,
  useColorScheme, Alert,
} from 'react-native';
```

- [ ] **Step 3: Add `BindEmailSheet` component**

Insert this component in `src/screens/Settings.tsx` right before the `AccountSecuritySheet` component (before the comment block at line 1573 `/* ══════════════ AccountSecuritySheet`):

```jsx
function BindEmailSheet({ onBound, onClose }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSave = email.includes('@') && password.length >= 6 && !loading;

  const handleBind = async () => {
    if (!canSave) return;
    setLoading(true);
    try {
      await bindEmail(email, password);
      onBound();
      onClose();
    } catch (e: any) {
      Alert.alert('绑定失败', e.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        <LayerHeader
          title="绑定邮箱"
          onBack={onClose}
          right={
            <TouchableOpacity
              onPress={handleBind}
              disabled={!canSave}
              activeOpacity={0.7}
              style={{
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                backgroundColor: canSave ? theme.accent : theme.sand,
              }}
            >
              <Text style={{
                fontFamily: theme.fonts.head, fontSize: 14,
                color: canSave ? '#FFFDF7' : theme.inkSoft,
              }}>{loading ? '绑定中...' : '绑定'}</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48 + insets.bottom }}>
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            绑定邮箱后，你可以用邮箱和密码登录，回忆不会丢失。
          </Text>

          <Text style={{
            marginTop: 22, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>邮箱</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="请输入邮箱"
            placeholderTextColor={theme.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              width: '100%', borderWidth: 1, borderColor: theme.line,
              borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
              backgroundColor: theme.paper, color: theme.ink,
              fontFamily: theme.fonts.body, fontSize: 16,
            }}
          />

          <Text style={{
            marginTop: 20, paddingHorizontal: 4, paddingBottom: 8,
            fontFamily: theme.fonts.head, fontSize: 14, color: theme.inkSoft,
          }}>密码</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="设置密码（至少 6 位）"
            placeholderTextColor={theme.inkSoft}
            secureTextEntry
            style={{
              width: '100%', borderWidth: 1, borderColor: theme.line,
              borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16,
              backgroundColor: theme.paper, color: theme.ink,
              fontFamily: theme.fonts.body, fontSize: 16,
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/Settings.tsx
git commit -m "feat(settings): add BindEmailSheet for guest account upgrade"
```

---

### Task 6: Update AccountSecuritySheet for Guest Mode

**Files:**
- Modify: `src/screens/Settings.tsx:1577-1697` (AccountSecuritySheet)

- [ ] **Step 1: Update the component signature and state**

Change the function signature at line 1577 from:

```typescript
function AccountSecuritySheet({ onClose }) {
```

to:

```typescript
function AccountSecuritySheet({ anon, onAnonChanged, onClose }) {
```

Update the state declaration at line 1580 to include `bindEmail` sub-sheet:

```typescript
  const [subSheet, setSubSheet] = useState(null); // 'changePhone' | 'deleteAccount' | 'bindEmail'
```

- [ ] **Step 2: Replace the description text**

Find the description text (lines 1589-1594):

```jsx
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            这些只关乎你怎么登进这个家。回忆和家人，都在前面那几栏里。
          </Text>
```

Replace with:

```jsx
          <Text style={{
            marginTop: 2, marginHorizontal: 4,
            fontFamily: theme.fonts.body, fontSize: 14.5, lineHeight: 25, color: theme.inkSoft,
          }}>
            {anon
              ? '你目前是游客身份。绑定手机号或邮箱后，回忆就不会丢失。'
              : '这些只关乎你怎么登进这个家。回忆和家人，都在前面那几栏里。'}
          </Text>
```

- [ ] **Step 3: Replace the login methods group**

Find the login methods SettingGroup (lines 1597-1611):

```jsx
          {/* Login methods */}
          <SettingGroup label="登录方式">
            <Row
              icon={Icon.phone(theme.accent, 19)}
              title="手机号"
              value="138 **** 6688"
              onPress={() => setSubSheet('changePhone')}
            />
            <Row
              icon={Icon.users(theme.accent, 19)}
              title="微信"
              value="已绑定"
              onPress={() => setShowUnbindWechat(true)}
              last
            />
          </SettingGroup>
```

Replace with:

```jsx
          {/* Login methods */}
          <SettingGroup label="登录方式">
            <Row
              icon={Icon.phone(theme.accent, 19)}
              title="手机号"
              value={anon ? '未绑定' : '138 **** 6688'}
              onPress={() => setSubSheet('changePhone')}
            />
            <Row
              icon={Icon.users(theme.accent, 19)}
              title="微信"
              value={anon ? '未绑定' : '已绑定'}
              onPress={anon ? undefined : () => setShowUnbindWechat(true)}
              last={anon ? false : true}
            />
            {anon ? (
              <Row
                icon={Icon.mail(theme.accent, 19)}
                title="邮箱"
                value="未绑定"
                onPress={() => setSubSheet('bindEmail')}
                last
              />
            ) : null}
          </SettingGroup>
```

- [ ] **Step 4: Add BindEmailSheet rendering**

Find the sub-sheets section (around line 1660-1666). After the existing `deleteAccount` conditional:

```jsx
      {subSheet === 'deleteAccount' ? (
        <DeleteAccountSheet onClose={() => setSubSheet(null)} />
      ) : null}
```

Add:

```jsx
      {subSheet === 'bindEmail' ? (
        <BindEmailSheet onBound={onAnonChanged} onClose={() => setSubSheet(null)} />
      ) : null}
```

- [ ] **Step 5: Update ChangePhoneSheet to hide "当前号码" for guests**

The `ChangePhoneSheet` component needs a prop to know if the user is a guest. Change the function signature from:

```typescript
function ChangePhoneSheet({ onClose }) {
```

to:

```typescript
function ChangePhoneSheet({ anon, onClose }) {
```

Then wrap the "当前号码" section (lines 1323-1331) in a conditional:

```jsx
          {/* Current number */}
          {!anon ? (
            <View style={{
              marginTop: 22, flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 15, paddingHorizontal: 18,
              backgroundColor: theme.sand, borderRadius: 18,
            }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.inkSoft }}>当前号码</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.ink }}>138 **** 6688</Text>
            </View>
          ) : null}
```

Also change the title for guests. Replace:

```jsx
          title="更换手机号"
```

with:

```jsx
          title={anon ? '绑定手机号' : '更换手机号'}
```

And update the call site in AccountSecuritySheet to pass the `anon` prop:

```jsx
      {subSheet === 'changePhone' ? (
        <ChangePhoneSheet anon={anon} onClose={() => setSubSheet(null)} />
      ) : null}
```

- [ ] **Step 6: Verify no syntax errors**

```bash
npx tsc --noEmit src/screens/Settings.tsx 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Settings.tsx
git commit -m "feat(settings): guest-aware AccountSecuritySheet with bind options"
```

---

### Task 7: Manual Smoke Test

- [ ] **Step 1: Restart Supabase with new config**

```bash
cd supabase-docker && docker compose down && docker compose up -d
```

Wait for services to be healthy.

- [ ] **Step 2: Start the app**

```bash
npx expo start
```

- [ ] **Step 3: Test the guest login flow**

1. On the LoginWelcome screen, verify the "先逛逛再说" button appears below the one-click login button
2. Verify the button is grayed out when the agreement checkbox is unchecked
3. Check the agreement checkbox, then tap "先逛逛再说"
4. Verify it navigates to Home
5. Go through the onboarding (choose role, add child) — verify it works normally

- [ ] **Step 4: Test the Settings guest indicators**

1. Open Settings from the drawer
2. Verify the "账户与安全" row shows "游客" in accent color
3. Tap into "账户与安全"
4. Verify the description says "你目前是游客身份..."
5. Verify phone shows "未绑定", WeChat shows "未绑定", email row appears with "未绑定"
6. Tap the phone row — verify ChangePhoneSheet opens with title "绑定手机号" and no "当前号码" row

- [ ] **Step 5: Test email binding**

1. In AccountSecuritySheet, tap the email "未绑定" row
2. Verify BindEmailSheet opens with "绑定邮箱" title
3. Enter a valid email and password (6+ chars)
4. Tap "绑定"
5. Verify success: sheet closes, the AccountSecuritySheet refreshes to normal (non-guest) view
6. Go back to Settings — verify "游客" badge is gone from the account row
