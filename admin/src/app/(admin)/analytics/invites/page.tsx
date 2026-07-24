import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FunnelViz, CsvDownloadButton } from '@/components/analytics-charts';
import { exportInvitesCsv } from '../_actions';
import type { FunnelStep } from '@/components/analytics-charts';

async function getInviteFunnelData() {
  const [tokensRes, openedRes, memTokensRes, recentTokensRes] = await Promise.all([
    supabaseAdmin.from('invite_tokens').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('invite_tokens')
      .select('*', { count: 'exact', head: true })
      .not('opened_at', 'is', null),
    supabaseAdmin
      .from('memories')
      .select('invite_token_id')
      .not('invite_token_id', 'is', null),
    // Last 30 days breakdown
    supabaseAdmin
      .from('invite_tokens')
      .select('id, is_active, opened_at, expires_at, created_at')
      .gte(
        'created_at',
        (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d.toISOString();
        })()
      ),
  ]);

  const total = tokensRes.count ?? 0;
  const opened = openedRes.count ?? 0;
  const memTokenIds = new Set(
    (memTokensRes.data ?? []).map((m) => m.invite_token_id).filter(Boolean)
  );
  const completed = memTokenIds.size;

  const steps: FunnelStep[] = [
    { label: '创建邀请', count: total, rate: 100 },
    {
      label: '打开链接',
      count: opened,
      rate: total > 0 ? Math.round((opened / total) * 100) : 0,
    },
    {
      label: '完成记录',
      count: completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  ];

  // Last 30 days stats
  const recentTokens = recentTokensRes.data ?? [];
  const recentTotal = recentTokens.length;
  const recentOpened = recentTokens.filter((t) => t.opened_at != null).length;
  const recentActive = recentTokens.filter(
    (t) => t.is_active && new Date(t.expires_at) >= new Date()
  ).length;
  const recentExpired = recentTokens.filter((t) => new Date(t.expires_at) < new Date()).length;

  return { steps, total, opened, completed, recentTotal, recentOpened, recentActive, recentExpired };
}

export default async function InvitesPage() {
  const {
    steps,
    total,
    opened,
    completed,
    recentTotal,
    recentOpened,
    recentActive,
    recentExpired,
  } = await getInviteFunnelData();

  const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;
  const completeRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const openToComplete =
    opened > 0 ? Math.round((completed / opened) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">邀记漏斗</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            从创建邀请到完成记录的全流程转化
          </p>
        </div>
        <CsvDownloadButton action={exportInvitesCsv} filename="invites-funnel.csv" />
      </div>

      {/* All-time summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总邀请数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">链接打开率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openRate}%</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {opened.toLocaleString()} 次打开
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">完成率（总）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{completeRate}%</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {completed.toLocaleString()} 个有回忆
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">打开→完成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openToComplete}%</div>
            <div className="mt-1 text-xs text-muted-foreground">打开后完成率</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelViz steps={steps} />

        {/* Last 30 days breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">最近 30 天邀请状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '总创建', value: recentTotal, color: '' },
              { label: '已打开', value: recentOpened, color: 'text-blue-600' },
              { label: '活跃中', value: recentActive, color: 'text-green-600' },
              { label: '已过期', value: recentExpired, color: 'text-muted-foreground' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-bold text-lg ${item.color}`}>
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
            {recentTotal > 0 && (
              <div className="pt-2 border-t text-xs text-muted-foreground">
                最近 30 天打开率：
                {Math.round((recentOpened / recentTotal) * 100)}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
