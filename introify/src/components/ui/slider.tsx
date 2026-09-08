"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SliderProps
  extends Omit<
    React.ComponentProps<"input">,
    "type" | "value" | "defaultValue" | "onChange"
  > {
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
}

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onValueChange,
  ...props
}: SliderProps) {
  const minN = Number(min)
  const maxN = Number(max)
  const stepN = Number(step) || 1
  const span = maxN - minN || 1
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = React.useState(
    () => defaultValue?.[0] ?? minN
  )
  const current = isControlled ? (value[0] ?? minN) : uncontrolled
  const pct = Math.min(100, Math.max(0, ((current - minN) / span) * 100))

  function commit(next: number) {
    const snapped = Math.round(next / stepN) * stepN
    const clamped = Math.min(maxN, Math.max(minN, snapped))
    if (!isControlled) setUncontrolled(clamped)
    onValueChange?.([clamped])
  }

  return (
    <div
      data-slot="slider"
      data-disabled={disabled || undefined}
      className={cn(
        "relative flex h-10 w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className
      )}
    >
      <div
        data-slot="slider-track"
        className="bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full"
      >
        <div
          data-slot="slider-range"
          className="bg-brand absolute h-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        min={minN}
        max={maxN}
        step={stepN}
        disabled={disabled}
        value={current}
        aria-valuemin={minN}
        aria-valuemax={maxN}
        aria-valuenow={current}
        onChange={(event) => commit(Number(event.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <div
        data-slot="slider-thumb"
        aria-hidden="true"
        className="border-brand bg-background pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm"
        style={{ left: `${pct}%` }}
      />
    </div>
  )
}

export { Slider }
