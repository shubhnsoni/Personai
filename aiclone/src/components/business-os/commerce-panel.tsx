"use client"

import { ShoppingBag } from "lucide-react"

import { CommerceOrdersPanel } from "./commerce-orders-panel"
import { CommerceVariantsPanel } from "./commerce-variants-panel"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

/**
 * Composes the two commerce surfaces: what you sell (variants) and what happens after it is
 * bought (shipments and returns). They are separate cards because they answer different
 * questions and an owner rarely needs both at once.
 *
 * `locationId` is where restocked units go. It comes from the selected workspace rather than
 * being invented here, and when a workspace has no location the restock controls say so and
 * stay disabled rather than failing at the write boundary.
 *
 * ---------------------------------------------------------------------------------------------
 * THE NO-WORKSPACE STATE IS OWNED HERE, and it did not used to be.
 *
 * Both children carry their own `!workspaceId` empty state, so composing them produced TWO
 * stacked cards both saying "Select a workspace" - one about products, one about orders. It was
 * reported as cosmetic, and it stopped being cosmetic when the shell stopped auto-selecting a
 * workspace for owners who have more than one: the state went from a momentary flash to somewhere
 * an owner can simply sit.
 *
 * The shared parent is the right owner of a message about the shared precondition, so this
 * renders it once and does not mount either child until a workspace exists.
 *
 * The children's own guards are deliberately LEFT IN PLACE rather than deleted:
 *
 *   they each gate their own fetch on `workspaceId`, and that guard must never be removed - a
 *   child that renders nothing but still requests `/products?workspaceId=` is worse than a
 *   duplicate message;
 *   both children are exported and usable on their own, and a standalone child that rendered an
 *   empty card with no explanation would be a new defect created while fixing this one.
 *
 * So the duplicate is removed by not mounting the children, not by making them less careful.
 */
export function CommercePanel({ workspaceId, locationId }: { workspaceId: string; locationId: string }) {
    if (!workspaceId) {
        return (
            <Card>
                <CardContent>
                    <EmptyState
                        icon={<ShoppingBag aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its products and orders."
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <CommerceVariantsPanel workspaceId={workspaceId} />
            <CommerceOrdersPanel workspaceId={workspaceId} locationId={locationId} />
        </>
    )
}
