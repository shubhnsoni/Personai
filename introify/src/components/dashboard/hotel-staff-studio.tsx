"use client"

import { useState, useTransition } from "react"
import { saveHotelStaffAssignments } from "@/app/actions/hotels"
import { HOTEL_STAFF_ROLES, hotelStaffLabel, type HotelStaffAssignment, type HotelStaffRole } from "@/lib/hotels"
import { StudioPanel } from "@/components/dashboard/studio-ui"

type Member = { userId: string; name: string; email: string }

export function HotelStaffStudio({
    members,
    assignments,
    canWrite,
}: {
    members: Member[]
    assignments: HotelStaffAssignment[]
    canWrite: boolean
}) {
    const [pending, start] = useTransition()
    const [rows, setRows] = useState<HotelStaffAssignment[]>(assignments)
    function roleOf(userId: string): HotelStaffRole {
        return rows.find((row) => row.userId === userId)?.role || "RECEPTION"
    }
    return (
        <StudioPanel className="p-4 md:p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Hotel desks</p>
            <p className="mt-1 text-sm text-muted-foreground">Department roles sit on top of team access. Owner and GM see every desk. Housekeeping only sees housekeeping tickets.</p>
            <ul className="mt-4 divide-y divide-white/8">
                {members.map((member) => (
                    <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{member.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                        <label className="text-xs text-muted-foreground">
                            <span className="sr-only">Desk for {member.name}</span>
                            <select
                                className="h-11 min-w-40 rounded-xl border border-white/10 bg-background px-3 text-sm text-foreground"
                                disabled={!canWrite || pending}
                                value={roleOf(member.userId)}
                                onChange={(event) => {
                                    const role = event.target.value as HotelStaffRole
                                    const next = [
                                        ...rows.filter((row) => row.userId !== member.userId),
                                        { userId: member.userId, role },
                                    ]
                                    setRows(next)
                                    start(async () => { await saveHotelStaffAssignments(next) })
                                }}
                            >
                                {HOTEL_STAFF_ROLES.map((role) => (
                                    <option key={role} value={role}>{hotelStaffLabel(role)}</option>
                                ))}
                            </select>
                        </label>
                    </li>
                ))}
            </ul>
            {!members.length ? <p className="text-sm text-muted-foreground">Invite a colleague on Staff, then assign a desk here.</p> : null}
        </StudioPanel>
    )
}
