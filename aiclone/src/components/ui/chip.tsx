import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border text-ui font-medium transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-border bg-muted/80 text-foreground hover:bg-muted",
        brand:
          "border-brand/30 bg-brand text-brand-foreground hover:bg-brand/90",
        outline:
          "border-border bg-transparent text-foreground hover:bg-muted",
        profile:
          "border-white/10 bg-profile-chip text-profile-text hover:bg-profile-elev hover:text-profile-text",
        "profile-brand":
          "border-brand/30 bg-brand text-brand-foreground hover:bg-brand/90",
      },
      size: {
        default: "min-h-10 px-3 sm:min-h-11 sm:px-4",
        sm: "min-h-9 px-2.5 text-micro",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {
  icon?: React.ReactNode
  label?: string
  highlighted?: boolean
  asChild?: boolean
}

function Chip({
  className,
  variant,
  size,
  icon,
  label,
  highlighted = false,
  asChild = false,
  children,
  type = "button",
  ...props
}: ChipProps) {
  const Comp = asChild ? Slot : "button"
  const resolved = highlighted
    ? variant === "profile" || variant === "profile-brand"
      ? "profile-brand"
      : "brand"
    : variant

  return (
    <Comp
      data-slot="chip"
      data-highlighted={highlighted || undefined}
      type={asChild ? undefined : type}
      className={cn(chipVariants({ variant: resolved, size, className }))}
      {...props}
    >
      {icon}
      {label}
      {children}
    </Comp>
  )
}

export { Chip, chipVariants }
