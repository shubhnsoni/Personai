"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex h-10 w-full max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden rounded-full bg-muted/80 p-1 text-muted-foreground scrollbar-hide",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-0 rounded-full border border-transparent text-sm font-medium whitespace-nowrap",
        "px-2 text-muted-foreground transition-all duration-200",
        "hover:text-foreground",
        "focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-background data-[state=active]:px-3 data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        "[&>span]:ml-0 [&>span]:inline-block [&>span]:max-w-0 [&>span]:overflow-hidden [&>span]:opacity-0 [&>span]:align-middle [&>span]:transition-all [&>span]:duration-200",
        "hover:[&>span]:ml-1.5 hover:[&>span]:max-w-[10rem] hover:[&>span]:opacity-100",
        "[&[data-state=active]>span]:ml-1.5 [&[data-state=active]>span]:max-w-[10rem] [&[data-state=active]>span]:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
