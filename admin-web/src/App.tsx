import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"

import { ActivitiesPage } from "@/features/activities"
import { ActivityLibraryPage } from "@/features/activity-library"
import { AuditLogPage } from "@/features/audit"
import { DashboardPage } from "@/features/dashboard"
import FamiliesPage from "@/features/families"
import { ModerationPage } from "@/features/moderation"
import { NotificationsPage } from "@/features/notifications"
import { RecordsPage } from "@/features/records"
import { SettingsPage } from "@/features/settings"
import UsersPage from "@/features/users"
import { AdminAuthGate, useAdminAuth } from "@/features/auth"
import type { AdminSession } from "@/lib/admin/types"

type PageId =
  | "dashboard"
  | "activity-library"
  | "records"
  | "users"
  | "families"
  | "moderation"
  | "activities"
  | "notifications"
  | "audit"
  | "settings"

const pageTitles: Record<PageId, string> = {
  dashboard: "数据总览",
  "activity-library": "事情定义",
  records: "完成记录",
  users: "用户管理",
  families: "家庭管理",
  moderation: "审核治理",
  activities: "推荐配置",
  notifications: "消息推送",
  audit: "操作审计",
  settings: "系统设置",
}

const pageDescriptions: Record<PageId, string> = {
  dashboard: "关键指标、待处理事项与近期运营状态。",
  "activity-library": "管理系统事情、家庭自定义事情与版本治理。",
  records: "查看完成记录、证据与治理访问痕迹。",
  users: "检索用户资料、账户状态与基础画像。",
  families: "管理家庭关系、成员与治理访问。",
  moderation: "处理举报、审核队列与治理动作。",
  activities: "配置推荐内容、排序与运营策略。",
  notifications: "创建和追踪后台消息推送。",
  audit: "查看后台操作审计与安全链路。",
  settings: "调整后台治理策略与系统开关。",
}

function sessionSidebarUser(session: AdminSession | null, demoMode: boolean) {
  if (demoMode) {
    return {
      name: "DEMO 管理员",
      email: "demo-admin@example.invalid",
      avatar: "",
    }
  }

  const profile = session?.profile
  const user = session?.user
  const metadata = user?.user_metadata
  const avatarUrl = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : ""
  const displayName =
    profile?.username?.trim() ||
    (typeof metadata?.name === "string" ? metadata.name.trim() : "") ||
    user?.email ||
    profile?.generated_email ||
    "一百件事管理员"

  return {
    name: displayName,
    email: user?.email ?? profile?.generated_email ?? "admin@yibai.local",
    avatar: avatarUrl,
  }
}

const pageIds = new Set<PageId>(Object.keys(pageTitles) as PageId[])

function pageFromHash(): PageId {
  const value = window.location.hash.replace(/^#\/?/, "") as PageId
  return pageIds.has(value) ? value : "dashboard"
}

export default function App() {
  const auth = useAdminAuth()
  const [activePage, setActivePage] = useState<PageId>(pageFromHash)

  useEffect(() => {
    const syncPage = () => setActivePage(pageFromHash())
    window.addEventListener("hashchange", syncPage)
    return () => window.removeEventListener("hashchange", syncPage)
  }, [])

  const navigate = useCallback((page: PageId) => {
    setActivePage(page)
    const nextHash = `#/${page}`
    if (window.location.hash !== nextHash) window.location.hash = nextHash
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  if (auth.status === "demo") {
    return <AdminShell activePage={activePage} demoMode onNavigate={navigate} session={null} onSignOut={async () => undefined} />
  }

  if (auth.status !== "authenticated" || !auth.session) {
    return <AdminAuthGate />
  }

  return <AdminShell activePage={activePage} onNavigate={navigate} session={auth.session} onSignOut={auth.signOut} />
}

function AdminShell({
  activePage,
  demoMode = false,
  onNavigate,
  onSignOut,
  session,
}: {
  activePage: PageId
  demoMode?: boolean
  onNavigate: (page: PageId) => void
  onSignOut: () => Promise<void>
  session: AdminSession | null
}) {
  const title = pageTitles[activePage]
  const description = pageDescriptions[activePage]
  const sidebarUser = useMemo(() => sessionSidebarUser(session, demoMode), [demoMode, session])

  const handleSignOut = useCallback(async () => {
    await onSignOut()
    onNavigate("dashboard")
  }, [onNavigate, onSignOut])

  const renderPage = () => {
    if (activePage === "activity-library") return <ActivityLibraryPage />
    if (activePage === "records") return <RecordsPage />
    if (activePage === "users") return <UsersPage />
    if (activePage === "families") return <FamiliesPage />
    if (activePage === "moderation") return <ModerationPage />
    if (activePage === "activities") return <ActivitiesPage />
    if (activePage === "notifications") return <NotificationsPage />
    if (activePage === "audit") return <AuditLogPage />
    if (activePage === "settings") return <SettingsPage />
    return <DashboardPage />
  }

  const banner = demoMode ? (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive shadow-xs">
        <Badge variant="destructive">DEMO</Badge>
        <span>当前使用演示数据源，不会读取或修改真实后台数据。</span>
      </div>
    </div>
  ) : null

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "4rem",
        } as CSSProperties
      }
    >
      <AppSidebar activePage={activePage} onNavigate={(page) => onNavigate(page as PageId)} />
      <SidebarInset className="min-w-0 bg-background">
        <SiteHeader title={title} description={description} role={session?.role} demoMode={demoMode} user={sidebarUser} onSignOut={handleSignOut} />
        {banner}
        {renderPage()}
      </SidebarInset>
      <Toaster position="top-center" />
    </SidebarProvider>
  )
}
