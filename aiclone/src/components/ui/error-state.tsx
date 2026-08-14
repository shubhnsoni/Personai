import * as React from "react"
import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ErrorStateProps extends React.ComponentProps<"div"> {
  title?: string
  description?: React.ReactNode
  action?: React.ReactNode
}

function ErrorState({
  className,
  title = "Something went wrong",
  description,
  action,
  children,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-4 py-8 text-center",
        className
      )}
      {...props}
    >
      <div className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-full">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-heading font-semibold tracking-tight">{title}</h2>
        {description ? (
          <div className="text-muted-foreground text-ui">{description}</div>
        ) : null}
      </div>
      {action}
      {children}
    </div>
  )
}

export { ErrorState }
