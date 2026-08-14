'use client'

import { useState } from 'react'

interface ChartDataPoint {
    date: string
    conversations: number
    leads: number
    revenue: number
}

interface AnalyticsChartsProps {
    data: ChartDataPoint[]
}

type MetricKey = 'conversations' | 'leads' | 'revenue'

const METRICS: { key: MetricKey; label: string; color: string }[] = [
    { key: 'conversations', label: 'Conversations', color: '#3b82f6' },
    { key: 'leads', label: 'Leads', color: '#eab308' },
    { key: 'revenue', label: 'Revenue ($)', color: '#22c55e' },
]

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
    const [activeMetric, setActiveMetric] = useState<MetricKey>('conversations')
    const [period, setPeriod] = useState<'7d' | '14d' | '30d'>('30d')

    const periodDays = period === '7d' ? 7 : period === '14d' ? 14 : 30
    const filtered = data.slice(-periodDays)

    const metric = METRICS.find(m => m.key === activeMetric)!
    const values = filtered.map(d => d[activeMetric])
    const maxVal = Math.max(...values, 1)

    const chartWidth = 600
    const chartHeight = 200
    const barWidth = Math.max(4, (chartWidth - 20) / filtered.length - 2)

    return (
        <div>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {METRICS.map(m => (
                        <button
                            key={m.key}
                            onClick={() => setActiveMetric(m.key)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                activeMetric === m.key ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 bg-muted rounded-lg p-1 ml-auto">
                    {(['7d', '14d', '30d'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                period === p ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary */}
            <div className="flex gap-6 mb-4 text-sm">
                <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-bold">
                        {activeMetric === 'revenue' ? `$${values.reduce((a, b) => a + b, 0).toFixed(0)}` : values.reduce((a, b) => a + b, 0)}
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground">Avg/day: </span>
                    <span className="font-bold">
                        {activeMetric === 'revenue'
                            ? `$${(values.reduce((a, b) => a + b, 0) / filtered.length).toFixed(1)}`
                            : (values.reduce((a, b) => a + b, 0) / filtered.length).toFixed(1)}
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground">Peak: </span>
                    <span className="font-bold">
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
                                    <title>{d.date}: {activeMetric === 'revenue' ? `$${val.toFixed(2)}` : val}</title>
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
