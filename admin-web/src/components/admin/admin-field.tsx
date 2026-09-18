import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function AdminField({
  children,
  className,
  description,
  error,
  htmlFor,
  label,
  required = false,
}: {
  children: ReactNode
  className?: string
  description?: ReactNode
  error?: ReactNode
  htmlFor: string
  label: ReactNode
  required?: boolean
}) {
  return (
    <div className={cn("grid gap-1.5", className)} data-slot="admin-field">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive" aria-hidden="true"> *</span> : null}
        {required ? <span className="sr-only">（必填）</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs leading-5 text-destructive" role="alert">
          {error}
        </p>
      ) : description ? (
        <p id={`${htmlFor}-description`} className="text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}
