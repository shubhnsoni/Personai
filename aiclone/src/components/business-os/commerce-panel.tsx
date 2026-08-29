"use client"

import { CommerceOrdersPanel } from "./commerce-orders-panel"
import { CommerceVariantsPanel } from "./commerce-variants-panel"

/**
 * Composes the two commerce surfaces: what you sell (variants) and what happens after it is
 * bought (shipments and returns). They are separate cards because they answer different
 * questions and an owner rarely needs both at once.
 *
 * `locationId` is where restocked units go. It comes from the selected workspace rather than
 * being invented here, and when a workspace has no location the restock controls say so and
 * stay disabled rather than failing at the write boundary.
 */
export function CommercePanel({ workspaceId, locationId }: { workspaceId: string; locationId: string }) {
    return (
        <>
            <CommerceVariantsPanel workspaceId={workspaceId} />
            <CommerceOrdersPanel workspaceId={workspaceId} locationId={locationId} />
        </>
    )
}
