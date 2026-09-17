import { loadHotelAnalytics } from "@/lib/hotels/store"
import { requireHotelPage } from "@/lib/hotels/desk-access"
import { StudioPageHead, StudioPanel } from "@/components/dashboard/studio-ui"

export const dynamic = "force-dynamic"

export default async function HotelAnalyticsPage() {
    const { profile } = await requireHotelPage("analytics")
    const summary = await loadHotelAnalytics(profile.id)
    const departments = Object.entries(summary.volumeByDepartment)
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Analytics" hint="Real request and QR counts. Question log uses stored guest chats. No invented revenue." />
            <StudioPanel className="grid grid-cols-2 divide-x divide-white/8 sm:grid-cols-4">
                <div className="px-4 py-4">
                    <p className="text-[11px] text-muted-foreground">Requests</p>
                    <p className="text-lg font-semibold tabular-nums">{departments.reduce((sum, [, n]) => sum + n, 0)}</p>
                </div>
                <div className="px-4 py-4">
                    <p className="text-[11px] text-muted-foreground">QR scans</p>
                    <p className="text-lg font-semibold tabular-nums">{summary.qrScansByCode.reduce((sum, row) => sum + row.scanCount, 0)}</p>
                </div>
                <div className="px-4 py-4">
                    <p className="text-[11px] text-muted-foreground">Handoff rate</p>
                    <p className="text-lg font-semibold tabular-nums">{Math.round(summary.handoffRate * 100)}%</p>
                </div>
                <div className="px-4 py-4">
                    <p className="text-[11px] text-muted-foreground">Top questions</p>
                    <p className="text-lg font-semibold tabular-nums">{summary.topQuestions.length}</p>
                </div>
            </StudioPanel>
            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Volume by desk</p>
                {departments.length ? departments.map(([dept, count]) => (
                    <p key={dept} className="flex justify-between text-sm">
                        <span>{dept.toLowerCase()}</span>
                        <span className="tabular-nums">{count}{summary.avgCompletionMinutes[dept] != null ? ` · ${Math.round(summary.avgCompletionMinutes[dept])}m avg` : ""}</span>
                    </p>
                )) : <p className="text-sm text-muted-foreground">No tickets yet.</p>}
            </StudioPanel>
            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">QR scans by code</p>
                {summary.qrScansByCode.length ? summary.qrScansByCode.map((row) => (
                    <p key={row.code} className="flex justify-between text-sm">
                        <span>{row.label || row.code}</span>
                        <span className="tabular-nums">{row.scanCount}</span>
                    </p>
                )) : <p className="text-sm text-muted-foreground">No scans yet.</p>}
            </StudioPanel>
            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">SLA</p>
                {summary.sla.map((row) => (
                    <p key={row.department} className="flex justify-between text-sm">
                        <span>{row.department.toLowerCase()} · {row.targetMinutes}m</span>
                        <span className="tabular-nums">
                            {row.open} open
                            {row.approaching ? ` · ${row.approaching} approaching` : ""}
                            {row.breached ? ` · ${row.breached} breached` : ""}
                        </span>
                    </p>
                ))}
            </StudioPanel>
            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Top questions</p>
                {summary.topQuestions.length ? summary.topQuestions.slice(0, 8).map((row) => (
                    <p key={row.text} className="flex justify-between gap-3 text-sm">
                        <span className="truncate">{row.text}</span>
                        <span className="tabular-nums">{row.count}</span>
                    </p>
                )) : <p className="text-sm text-muted-foreground">No stored guest questions yet.</p>}
            </StudioPanel>
        </div>
    )
}
