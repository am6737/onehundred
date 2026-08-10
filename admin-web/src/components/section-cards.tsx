"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>累计用户</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">12,680</CardTitle>
          <CardAction><Badge variant="outline"><TrendingUpIcon />+12.5%</Badge></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">本月用户保持增长 <TrendingUpIcon className="size-4" /></div>
          <div className="text-muted-foreground">过去 6 个月累计注册用户</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>本月新增家庭</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">1,234</CardTitle>
          <CardAction><Badge variant="outline"><TrendingDownIcon />-8.2%</Badge></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">新增速度略有放缓 <TrendingDownIcon className="size-4" /></div>
          <div className="text-muted-foreground">邀请转化需要持续关注</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>活跃家庭</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">3,846</CardTitle>
          <CardAction><Badge variant="outline"><TrendingUpIcon />+18.3%</Badge></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">家庭互动明显提升 <TrendingUpIcon className="size-4" /></div>
          <div className="text-muted-foreground">本月完成记录的活跃家庭</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>内容完成率</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">72.4%</CardTitle>
          <CardAction><Badge variant="outline"><TrendingUpIcon />+4.5%</Badge></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">内容完成率稳步提高 <TrendingUpIcon className="size-4" /></div>
          <div className="text-muted-foreground">高于本季度预设目标</div>
        </CardFooter>
      </Card>
    </div>
  )
}
