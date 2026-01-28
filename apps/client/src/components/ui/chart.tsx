"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import type {
  Payload,
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent"

import { cn } from "@/lib/utils"

const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, cfg]) => cfg.theme || cfg.color
  )
  if (!colorConfig.length) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

/* -------------------------
   Tooltip
   ------------------------- */

type CustomTooltipProps = {
  active?: boolean
  payload?: Payload<ValueType, NameType>[]
  label?: string
  className?: string
}

function ChartTooltipContent({ active, payload, label, className }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div
      className={cn(
        "bg-background border text-xs rounded-lg px-2.5 py-1.5 shadow-xl",
        className
      )}
    >
      {label && <div className="font-medium">{label}</div>}
      <div className="grid gap-1">
        {payload.map((item, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{item.name}</span>
            <span className="font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

/* -------------------------
   Legend
   ------------------------- */

const ChartLegend = RechartsPrimitive.Legend

type CustomLegendProps = {
  className?: string
  payload?: Array<{
    value?: string
    color?: string
    dataKey?: string | number
  }>
  verticalAlign?: "top" | "bottom" | "middle"
}

function ChartLegendContent({
  className,
  payload = [],
  verticalAlign = "bottom",
}: CustomLegendProps) {
  if (!payload.length) return null

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-1.5"
        >
          <div
            className="h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export {
  useChart,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
