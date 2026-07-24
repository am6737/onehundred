import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function ActivitiesPage() {
  const { data: levels } = await supabaseAdmin
    .from('levels')
    .select('num, title, perspective, tone, suggest, sealed, seasonal, sort_order')
    .order('sort_order', { ascending: true })
    .limit(100);

  const perspectiveLabels: Record<string, string> = {
    parent: '家长',
    child: '孩子',
    together: '一起',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">活动管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>事项列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">编号</th>
                  <th className="p-3">标题</th>
                  <th className="p-3">视角</th>
                  <th className="p-3">建议记录方式</th>
                  <th className="p-3">标签</th>
                </tr>
              </thead>
              <tbody>
                {levels?.map((l) => (
                  <tr key={l.num} className="border-b">
                    <td className="p-3 font-mono font-medium">{l.num}</td>
                    <td className="p-3">{l.title}</td>
                    <td className="p-3">{perspectiveLabels[l.perspective] ?? l.perspective}</td>
                    <td className="p-3">{l.suggest}</td>
                    <td className="p-3 space-x-1">
                      {l.sealed && <Badge variant="secondary">封存</Badge>}
                      {l.seasonal && <Badge variant="outline">季节性</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
