import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { act } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { recordSnapshots } from "./helpers/commits"

/**
 * LeadsStudio / LeadDetail behaviour.
 *
 * WHY THIS IS THE FIRST TIME THIS COMPONENT COULD BE TESTED
 * --------------------------------------------------------
 * The note field lives inside a Radix Sheet, which is a portal that renders NOTHING until it is
 * mounted and open. Under `renderToStaticMarkup` the whole detail pane is 0 bytes, so the effect at
 * leads-studio.tsx:282 and everything it touches were unobservable. A real DOM mounts the portal.
 *
 * The server actions are mocked because they are `"use server"` functions; calling one in jsdom
 * would attempt a server round-trip. Mocking them also lets the tests assert exactly what would
 * have been persisted, which is the point of the most important test in this file.
 */

const updateLeadNote = vi.fn(async () => {})
const updateLeadStatus = vi.fn(async () => {})
const setLeadFollowUp = vi.fn(async () => {})
const deleteLead = vi.fn(async () => {})
const createLead = vi.fn(async () => {})

vi.mock("@/app/actions/leads", () => ({
    updateLeadNote: (...a: unknown[]) => updateLeadNote(...(a as [])),
    updateLeadStatus: (...a: unknown[]) => updateLeadStatus(...(a as [])),
    setLeadFollowUp: (...a: unknown[]) => setLeadFollowUp(...(a as [])),
    deleteLead: (...a: unknown[]) => deleteLead(...(a as [])),
    createLead: (...a: unknown[]) => createLead(...(a as [])),
}))

const { LeadsStudio } = await import("@/components/dashboard/leads-studio")
type StudioLead = Parameters<typeof LeadsStudio>[0]["leads"][number]

function lead(over: Partial<StudioLead> & { id: string; name: string }): StudioLead {
    return {
        email: `${over.id}@example.com`,
        company: null,
        budgetRange: null,
        status: "new",
        note: "",
        followUpAt: null,
        activity: [],
        createdAt: new Date("2026-05-01T10:00:00Z").toISOString(),
        chatId: null,
        lastChat: null,
        waitingOnYou: false,
        purchases: [],
        courses: [],
        bookings: 0,
        ...over,
    } as StudioLead
}

const ADA = lead({ id: "a", name: "Ada Lovelace", note: "Wants the enterprise tier" })
const GRACE = lead({ id: "g", name: "Grace Hopper", note: "Asked for a discount" })

function renderStudio(leads = [ADA, GRACE]) {
    return render(<LeadsStudio leads={leads} slug="studio" displayName="Studio" />)
}

function openLead(name: string) {
    act(() => {
        screen.getByText(name).closest("button")!.click()
    })
}

function noteField() {
    // The Label in this component is not associated with the Textarea (no htmlFor/id pair), so
    // getByRole("textbox", { name: /note/i }) cannot find it. Selecting by placeholder is the
    // honest accessor here rather than pretending the accessible name exists. The missing
    // association is a real accessibility gap and is reported, not fixed - it is outside the eight
    // lint errors and changing markup would be an unrequested semantic change.
    return screen.getByPlaceholderText(/Next step, fit, anything useful/) as HTMLTextAreaElement
}

function saveNoteButton() {
    return screen.getByRole("button", { name: "Save note" }) as HTMLButtonElement
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe("LeadsStudio - server-side rendering", () => {
    it("renders the list on the server and renders the Sheet portal as nothing", () => {
        const html = renderToStaticMarkup(<LeadsStudio leads={[ADA, GRACE]} slug="studio" displayName="Studio" />)
        expect(html).toContain("Ada Lovelace")
        expect(html).toContain("Grace Hopper")
        // This is the measurement that explains why the previous wave could not test :282 at all.
        expect(html).not.toContain("Save note")
        expect(html).not.toContain("Next step, fit, anything useful")
    })

    it("renders the empty state when there are no leads", () => {
        const html = renderToStaticMarkup(<LeadsStudio leads={[]} slug="studio" displayName="Studio" />)
        expect(html).toContain("No leads yet")
    })
})

describe("LeadsStudio - the note field inside the portal", () => {
    it("mounts the portal on selection and seeds the note from the lead", () => {
        renderStudio()
        expect(screen.queryByRole("button", { name: "Save note" })).toBeNull()
        openLead("Ada Lovelace")
        expect(noteField().value).toBe("Wants the enterprise tier")
    })

    it("keeps Save disabled until the note actually differs", () => {
        renderStudio()
        openLead("Ada Lovelace")
        expect(saveNoteButton().disabled).toBe(true)

        // fireEvent.change, not a hand-dispatched input event: React 19 keeps its own value tracker on the node and would treat a directly assigned value as unchanged, so the onChange handler would never run.
        act(() => {
            fireEvent.change(noteField(), { target: { value: "Wants the enterprise tier plus SSO" } })
        })
        expect(saveNoteButton().disabled).toBe(false)
    })

    it("persists the edited note for the lead that is open", async () => {
        renderStudio()
        openLead("Ada Lovelace")
        act(() => {
            fireEvent.change(noteField(), { target: { value: "Signed" } })
        })
        await act(async () => {
            saveNoteButton().click()
        })
        expect(updateLeadNote).toHaveBeenCalledWith("a", "Signed")
    })
})

/**
 * THE CASCADING-RENDER TEST - tied to the lint error at leads-studio.tsx:282.
 *
 * `setNote(lead?.note || "")` runs synchronously in the effect body, so switching from lead A to
 * lead B commits a frame in which the Sheet already shows B's name and email while the note
 * textarea still holds A's note.
 *
 * This is not only a flash. In that frame `note` is A's text and `lead.note` is B's, so
 * `disabled={pending || note === lead.note}` evaluates to FALSE and the "Save note" button is
 * live. A click landing in that frame writes A's private note onto B's record. That makes this a
 * data-integrity defect, not a cosmetic one.
 */
describe("LeadsStudio - no stale note frame when switching leads", () => {
    it("shows the newly opened lead's note, not the previous one's", () => {
        renderStudio()
        openLead("Ada Lovelace")
        expect(noteField().value).toBe("Wants the enterprise tier")
        openLead("Grace Hopper")
        expect(noteField().value).toBe("Asked for a discount")
        expect(saveNoteButton().disabled).toBe(true)
    })

    it("never lets Save go live with the previous lead's text (the corruption path)", () => {
        // The projection runs in the Profiler's commit-phase callback, which is the only place the
        // intermediate frame is visible: act() does not return until the cascade has finished, by
        // which time the note has already been corrected.
        const { snapshots, Recorder } = recordSnapshots(() => {
            const field = document.querySelector<HTMLTextAreaElement>(
                "textarea[placeholder^='Next step']",
            )
            const button = Array.from(document.querySelectorAll("button")).find(
                (b) => b.textContent?.trim() === "Save note",
            ) as HTMLButtonElement | undefined
            return field && button ? { note: field.value, saveEnabled: !button.disabled } : null
        })

        render(
            <Recorder>
                <LeadsStudio leads={[ADA, GRACE]} slug="studio" displayName="Studio" />
            </Recorder>,
        )

        openLead("Ada Lovelace")
        snapshots.length = 0
        openLead("Grace Hopper")

        // Every commit must be internally consistent. If Save is live, the text on screen must be
        // something the user typed for THIS lead - never the note belonging to the previous one.
        // A click landing in such a frame would write Ada's private note onto Grace's record.
        const corrupting = snapshots.filter((s) => s && s.saveEnabled && s.note === ADA.note)
        expect(
            corrupting,
            `commits observed while switching leads: ${JSON.stringify(snapshots)}`,
        ).toHaveLength(0)
    })
})
