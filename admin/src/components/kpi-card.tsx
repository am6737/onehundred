import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card } from '@/components/tremor/Card';
import { Badge } from '@/components/tremor/Badge';

export function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: number;
  /** Week-over-week % change; omit/null to hide the badge. */
  delta?: number | null;
  hint?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {hasDelta && (
          <Badge variant={up ? 'success' : 'error'} className="gap-0.5 tabular-nums">
            {up ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(delta as number).toFixed(1)}%
          </Badge>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString()}
      </p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
