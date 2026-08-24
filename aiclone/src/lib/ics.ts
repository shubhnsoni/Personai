export type CalEvent = {
    id: string
    title: string
    description?: string
    start: Date
    end: Date
    status?: string
}

function pad(n: number) {
    return String(n).padStart(2, "0")
}

export function icsUtc(d: Date) {
    return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        "T" +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        "Z"
    )
}

function escapeText(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

function fold(line: string) {
    if (line.length <= 74) return line
    const parts = [line.slice(0, 74)]
    let rest = line.slice(74)
    while (rest.length > 73) {
        parts.push(" " + rest.slice(0, 73))
        rest = rest.slice(73)
    }
    if (rest) parts.push(" " + rest)
    return parts.join("\r\n")
}

export function buildIcs(opts: {
    name: string
    events: CalEvent[]
    timezone?: string
}): string {
    const stamp = icsUtc(new Date())
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PersonaLink//Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${escapeText(opts.name)}`,
        "X-WR-CALDESC:Bookings from PersonaLink",
    ]
    if (opts.timezone) lines.push(`X-WR-TIMEZONE:${opts.timezone}`)

    for (const event of opts.events) {
        const cancelled = event.status === "CANCELLED"
        lines.push("BEGIN:VEVENT")
        lines.push(`UID:${event.id}@personalink`)
        lines.push(`DTSTAMP:${stamp}`)
        lines.push(`DTSTART:${icsUtc(event.start)}`)
        lines.push(`DTEND:${icsUtc(event.end)}`)
        lines.push(`SUMMARY:${escapeText(event.title)}`)
        if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
        lines.push(`STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`)
        lines.push("END:VEVENT")
    }

    lines.push("END:VCALENDAR")
    return lines.map(fold).join("\r\n") + "\r\n"
}

export function googleTemplateUrl(event: CalEvent) {
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${icsUtc(event.start)}/${icsUtc(event.end)}`,
        details: event.description || "",
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookTemplateUrl(event: CalEvent) {
    const params = new URLSearchParams({
        path: "/calendar/action/compose",
        rru: "addevent",
        subject: event.title,
        startdt: event.start.toISOString(),
        enddt: event.end.toISOString(),
        body: event.description || "",
    })
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function googleSubscribeUrl(icsHttps: string) {
    return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icsHttps)}`
}

export function outlookSubscribeUrl(icsHttps: string) {
    return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(icsHttps)}`
}

export function appleSubscribeUrl(icsHttps: string) {
    return icsHttps.replace(/^https?:\/\//, "webcal://")
}

export function icsResponse(body: string, filename: string) {
    return new Response(body, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    })
}
