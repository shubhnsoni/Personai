'use client'

import { useState } from 'react'

interface ChartDataPoint {
    date: string
    visits?: number
    conversations: number
    leads: number
    revenue: number
}

interface AnalyticsChartsProps {
    data: ChartDataPoint[]
}

type MetricKey = 'visits' | 'conversations' | 'leads' | 'revenue'

const METRICS: { key: MetricKey; label: string; color: string }[] = [
    { key: 'visits', label: 'Visits', color: '#00D7FF' },
    { key: 'conversations', label: 'Conversations', color: '#3b82f6' },
    { key: 'leads', label: 'Leads', color: '#eab308' },
    { key: 'revenue', label: 'Revenue ($)', color: '#22c55e' },
]

export function AnalyticsCharts({ data, hideLeads, hideSales }: AnalyticsChartsProps & { hideLeads?: boolean; hideSales?: boolean }) {
    const metrics = METRICS.filter((m) => !(m.key === "leads" && hideLeads) && !(m.key === "revenue" && hideSales))
    const [activeMetric, setActiveMetric] = useState<MetricKey>('visits')
    const [period, setPeriod] = useState<'7d' | '14d' | '30d'>('30d')

    const periodDays = period === '7d' ? 7 : period === '14d' ? 14 : 30
    const filtered = data.slice(-periodDays)

    const metric = metrics.find(m => m.key === activeMetric) || metrics[0]
    const values = filtered.map(d => d[activeMetric] || 0)
    const maxVal = Math.max(...values, 1)

    const chartWidth = 600
    const chartHeight = 220
    const barWidth = Math.max(4, (chartWidth - 20) / filtered.length - 2)
    const total = values.reduce((a, b) => a + b, 0)

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex gap-0.5 rounded-full bg-white/6 p-0.5">
                    {metrics.map(m => (
                        <button
                            key={m.key}
                            onClick={() => setActiveMetric(m.key)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                activeMetric === m.key ? 'bg-[#00D7FF] text-[#061018]' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex gap-0.5 rounded-full bg-white/6 p-0.5">
                    {(['7d', '14d', '30d'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                period === p ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-4 flex gap-6 text-sm">
                <div>
                    <span className="text-muted-foreground">Total </span>
                    <span className="font-semibold tabular-nums">
                        {activeMetric === 'revenue' ? `$${total.toFixed(0)}` : total}
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground">Avg </span>
                    <span className="font-semibold tabular-nums">
                        {activeMetric === 'revenue'
                            ? `$${(total / Math.max(filtered.length, 1)).toFixed(1)}`
                            : (total / Math.max(filtered.length, 1)).toFixed(1)}
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground">Peak </span>
                    <span className="font-semibold tabular-nums">
                        {activeMetric === 'revenue' ? `$${maxVal.toFixed(0)}` : maxVal}
                    </span>
                </div>
            </div>

            {/* SVG Bar Chart */}
            <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} className="w-full" style={{ minWidth: '300px' }}>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const y = chartHeight - pct * chartHeight
                        return (
                            <g key={pct}>
                                <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="currentColor" strokeOpacity="0.1" />
                                <text x="0" y={y - 4} fontSize="9" fill="currentColor" opacity="0.4">
                                    {activeMetric === 'revenue' ? `$${(maxVal * pct).toFixed(0)}` : Math.round(maxVal * pct)}
                                </text>
                            </g>
                        )
                    })}

                    {/* Bars */}
                    {filtered.map((d, i) => {
                        const val = d[activeMetric]
                        const barHeight = (val / maxVal) * chartHeight
                        const x = 10 + i * ((chartWidth - 20) / filtered.length)
                        return (
                            <g key={d.date}>
                                <rect
                                    x={x}
                                    y={chartHeight - barHeight}
                                    width={barWidth}
                                    height={Math.max(barHeight, 0)}
                                    fill={metric.color}
                                    rx="2"
                                    opacity="0.8"
                                >
                                    <title>{`${d.date}: ${activeMetric === "revenue" ? `$${val.toFixed(2)}` : val}`}</title>
                                </rect>
                                {/* Date labels (show every Nth) */}
                                {(i % Math.ceil(filtered.length / 7) === 0 || i === filtered.length - 1) && (
                                    <text
                                        x={x + barWidth / 2}
                                        y={chartHeight + 16}
                                        fontSize="9"
                                        fill="currentColor"
                                        opacity="0.5"
                                        textAnchor="middle"
                                    >
                                        {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                    </text>
                                )}
                            </g>
                        )
                    })}
                </svg>
            </div>
        </div>
    )
}
