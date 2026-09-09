import { describe, expect, it } from "vitest"
import { renderToString } from "react-dom/server"
import { AdminEmpty, AdminKpi, AdminPageHead, AdminStatus } from "@/components/admin/admin-ui"

describe("admin primitives", () => {
    it("renders a page head without the old Platform kicker", () => {
        const html = renderToString(<AdminPageHead title="Today" hint="Pulse" />)
        expect(html).toContain("Today")
        expect(html).toContain("Pulse")
        expect(html).not.toContain("uppercase tracking-[0.18em]")
    })

    it("renders KPI and status", () => {
        const kpi = renderToString(<AdminKpi title="Live" value={12} href="/admin/traffic" />)
        expect(kpi).toContain('href="/admin/traffic"')
        expect(kpi).toContain("12")
        const status = renderToString(<AdminStatus ok label="Clerk" />)
        expect(status).toContain("Clerk")
        const empty = renderToString(<AdminEmpty>No shops.</AdminEmpty>)
        expect(empty).toContain("No shops.")
    })
})
