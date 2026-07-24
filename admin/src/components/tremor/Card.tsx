// Tremor Card [v1.0.0] — adapted: plain div (no Slot dep), app design tokens

import React from "react"

import { cx } from "./cx"

type CardProps = React.ComponentPropsWithoutRef<"div">

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, forwardedRef) => {
    return (
      <div
        ref={forwardedRef}
        className={cx(
          // base
          "relative w-full rounded-lg border p-6 text-left shadow-xs",
          // surface + border from the app's design tokens (matches sidebar/tables)
          "bg-card border-border",
          className,
        )}
        {...props}
      />
    )
  },
)

Card.displayName = "Card"

export { Card, type CardProps }
