import * as React from "react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}

function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 py-8 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full [&>svg]:size-5">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-heading font-semibold tracking-tight">{title}</h3>
        {description ? (
          <div className="text-muted-foreground text-ui mx-auto max-w-sm">
            {description}
          </div>
        ) : null}
      </div>
      {action}
      {children}
    </div>
  )
}

export { EmptyState }
