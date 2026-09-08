import * as React from "react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.ComponentProps<"div"> {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}

function PageHeader({
  className,
  title,
  description,
  actions,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <h2 className="text-title font-bold tracking-tight">{title}</h2>
        {description ? (
          <div className="text-muted-foreground text-ui">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
      {children}
    </div>
  )
}

export { PageHeader }
