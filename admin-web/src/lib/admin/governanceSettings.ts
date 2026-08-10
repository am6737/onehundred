import * as React from "react"

const storageKey = "yibai.admin.manual-governance-authorization"
const changeEvent = "yibai:governance-settings-change"
let fallbackEnabled = true

export const automaticDebugGovernanceReason = "[DEBUG] 系统设置已关闭手动治理授权"

function readEnabled() {
  if (typeof window === "undefined") return fallbackEnabled
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored !== null) fallbackEnabled = stored !== "false"
  } catch {
    // 某些隐私模式或嵌入式浏览器会禁用 localStorage，当前会话仍使用内存状态。
  }
  return fallbackEnabled
}

export function isManualGovernanceAuthorizationEnabled() {
  return readEnabled()
}

export function setManualGovernanceAuthorizationEnabled(enabled: boolean) {
  fallbackEnabled = enabled
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey, String(enabled))
  } catch {
    // localStorage 不可用时，至少保证当前页面会话可以正常切换。
  }
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: { enabled } }))
}

export function resolveGovernanceReason(reason?: string | null) {
  if (!readEnabled()) return automaticDebugGovernanceReason
  return reason?.trim() ?? ""
}

export function isGovernanceReasonReady(reason?: string | null, minimumLength = 8) {
  return !readEnabled() || (reason?.trim().length ?? 0) >= minimumLength
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => undefined
  window.addEventListener(changeEvent, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(changeEvent, listener)
    window.removeEventListener("storage", listener)
  }
}

export function useGovernanceAuthorizationSettings() {
  const manualAuthorizationEnabled = React.useSyncExternalStore(subscribe, readEnabled, () => true)
  return {
    manualAuthorizationEnabled,
    automaticReason: automaticDebugGovernanceReason,
    setManualAuthorizationEnabled: setManualGovernanceAuthorizationEnabled,
  }
}
