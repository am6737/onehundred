import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircleIcon, LoaderCircleIcon, LogInIcon, RefreshCwIcon, ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from './AdminAuthProvider';

function displayAuthError(message: string | null | undefined, fallback = '登录失败，请稍后重试。') {
  if (!message) return fallback;

  const normalized = message.toLowerCase();

  if (
    normalized.includes('admin_role') ||
    normalized.includes('not_admin') ||
    normalized.includes('recognized admin role') ||
    normalized.includes('does not have profiles.')
  ) {
    return '此账号没有管理后台访问权限。';
  }

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('email not confirmed') ||
    normalized.includes('admin sign in failed')
  ) {
    return '邮箱或密码不正确。';
  }

  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('not_authenticated')) {
    return '登录状态已失效，请重新登录。';
  }

  if (
    normalized.includes('vite_') ||
    normalized.includes('supabase') ||
    normalized.includes('rls') ||
    normalized.includes('rpc') ||
    normalized.includes('repository') ||
    normalized.includes('permission denied') ||
    normalized.includes('policy')
  ) {
    return '登录服务暂时不可用，请稍后重试。';
  }

  return message;
}

function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-[440px] flex-col justify-center">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid size-11 place-items-center rounded-lg border bg-card text-foreground shadow-xs">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-medium leading-none">一百件事</p>
            <p className="text-sm text-muted-foreground">管理后台</p>
          </div>
        </div>
        <Card className="gap-4 rounded-lg max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <CardHeader>
            <CardTitle className="text-lg tracking-tight">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {children ? <CardContent>{children}</CardContent> : null}
        </Card>
      </div>
    </main>
  );
}

function LoginForm() {
  const { error, signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setSubmitError(null);
    try {
      await signIn(email.trim(), password);
      setPassword('');
    } catch (signInError) {
      setPassword('');
      setSubmitError(signInError instanceof Error ? signInError.message : '管理员登录失败。');
    } finally {
      setPending(false);
    }
  }

  const visibleError = submitError ?? error;

  return (
    <AuthShell title="登录" description="输入管理员邮箱和密码继续。">
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <Label htmlFor="admin-email">邮箱</Label>
          <Input
            id="admin-email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="admin-password">密码</Label>
          <Input
            id="admin-password"
            autoComplete="current-password"
            placeholder="输入密码"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />
        </div>
        {visibleError ? (
          <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            <span>{displayAuthError(visibleError)}</span>
          </div>
        ) : null}
        <Button type="submit" className="mt-1 w-full" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <LogInIcon />}
          {pending ? '登录中...' : '登录'}
        </Button>
      </form>
    </AuthShell>
  );
}

export function AdminAuthGate() {
  const { error, refreshSession, status } = useAdminAuth();
  const [retrying, setRetrying] = useState(false);

  if (status === 'loading') {
    return (
      <AuthShell title="正在检查登录状态" description="请稍候，系统正在恢复你的管理会话。">
        <div className="flex items-center gap-2 rounded-md border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          <span>正在载入...</span>
        </div>
      </AuthShell>
    );
  }

  if (status === 'error') {
    async function handleRetry() {
      if (retrying) return;
      setRetrying(true);
      try {
        await refreshSession();
      } finally {
        setRetrying(false);
      }
    }

    return (
      <AuthShell title="无法进入管理后台" description="请重试，或联系系统维护人员确认访问状态。">
        <div className="grid gap-4">
          <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            <span>{displayAuthError(error, '暂时无法进入管理后台。')}</span>
          </div>
          <Button type="button" variant="outline" onClick={handleRetry} disabled={retrying}>
            {retrying ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
            {retrying ? '重试中' : '重试'}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return <LoginForm />;
}
