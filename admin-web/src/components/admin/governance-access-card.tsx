import { CheckCircle2Icon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useGovernanceAuthorizationSettings } from "@/lib/admin/governanceSettings"
import { cn } from "@/lib/utils"

export const minimumGovernanceReasonLength = 8

export function GovernanceAccessCard({
  title = "治理访问授权",
  description,
  reason,
  loadedReason,
  loading,
  placeholder,
  onReasonChange,
  onLoad,
}: {
  title?: string
  description: string
  reason: string
  loadedReason: string | null
  loading: boolean
  placeholder: string
  onReasonChange: (value: string) => void
  onLoad: () => void
}) {
  const { automaticReason, manualAuthorizationEnabled } = useGovernanceAuthorizationSettings()
  const trimmedReason = reason.trim()
  const isValid = !manualAuthorizationEnabled || trimmedReason.length >= minimumGovernanceReasonLength
  const remaining = Math.max(0, minimumGovernanceReasonLength - trimmedReason.length)

  if (!manualAuthorizationEnabled) {
    return (
      <Card className="border-amber-300/60 bg-amber-50/70 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/8">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300"><LockKeyholeIcon className="size-5" /></span>
            <div><h2 className="font-heading text-base font-semibold">手动治理授权已关闭</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">调试模式会自动使用理由：{automaticReason}。数据库治理校验和审计记录仍然保留。</p></div>
          </div>
          <Button onClick={onLoad} disabled={loading} className="shrink-0"><ShieldCheckIcon />{loading ? "正在加载" : loadedReason ? "刷新数据" : "加载数据"}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/15 bg-linear-to-br from-primary/[0.055] via-card to-card shadow-sm">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:items-center">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <LockKeyholeIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">{title}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              {loadedReason ? <CheckCircle2Icon className="size-3.5 text-emerald-600" /> : <ShieldCheckIcon className="size-3.5" />}
              {loadedReason ? `已授权：${loadedReason}` : "访问会记录在治理与审计链路中"}
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            className={cn(
              "min-h-24 w-full resize-y rounded-xl border bg-background/90 px-3.5 py-3 text-sm leading-6 shadow-xs outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
              reason.length > 0 && !isValid && "border-amber-400/70",
            )}
            placeholder={placeholder}
            aria-label="治理访问理由"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className={cn("text-xs text-muted-foreground", reason.length > 0 && !isValid && "text-amber-700 dark:text-amber-400")}>
              {isValid ? "理由有效，可以加载受治理数据" : `还需输入 ${remaining} 个字符`}
            </span>
            <Button onClick={onLoad} disabled={loading || !isValid} className="sm:min-w-40">
              <ShieldCheckIcon />
              {loading ? "正在安全加载" : loadedReason ? "重新授权并刷新" : "授权并加载数据"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
