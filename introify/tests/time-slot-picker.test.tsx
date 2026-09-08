import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { act } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TimeSlotPicker } from "@/components/booking/time-slot-picker"
import { framesSince, recordCommits } from "./helpers/commits"

/**
 * TimeSlotPicker behaviour.
 *
 * WHY THIS IS THE FIRST TIME THIS COMPONENT COULD BE TESTED
 * --------------------------------------------------------
 * The effect at time-slot-picker.tsx:74 opens with `if (!selectedDate) return`, and `selectedDate`
 * is only ever set by a date button's onClick. Under `renderToStaticMarkup` - the only tool the
 * previous wave had - there is no click, so that effect was unreachable and every behaviour behind
 * it (loading state, booked-slot filtering, the onSelect payload) was unverifiable.
 */

// All seven weekdays are enabled on purpose. The component derives its date strings with
// `toISOString()` (UTC) but reads the weekday with `getDay()` (local), so a fixture that enabled
// only some weekdays would make these tests depend on the machine's timezone. Enabling all seven
// removes that variable from every assertion below. The UTC/local mismatch is a real latent defect
// in this component, but it is not one of the eight lint errors and fixing it would change
// behaviour, so it is reported rather than silently changed.
const ALL_DAYS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "11:00",
    isEnabled: true,
}))

type Deferred = { resolve: (booked: string[]) => void; reject: (e: Error) => void }

/** Installs a fetch stub whose responses this test resolves by hand, one deferred per call. */
function stubFetch() {
    const pending: Deferred[] = []
    const urls: string[] = []
    vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
            urls.push(String(url))
            return new Promise((resolve, reject) => {
                pending.push({
                    resolve: (booked) => resolve({ json: () => Promise.resolve({ bookedSlots: booked }) } as Response),
                    reject,
                })
            })
        }),
    )
    return { pending, urls }
}

/** Settles a deferred fetch and lets React flush the resulting state updates. */
async function settle(d: Deferred, booked: string[]) {
    await act(async () => {
        d.resolve(booked)
        await Promise.resolve()
    })
}

function props(overrides: Partial<Parameters<typeof TimeSlotPicker>[0]> = {}) {
    return {
        profileId: "p1",
        serviceId: "s1",
        durationMinutes: 60,
        availability: ALL_DAYS,
        onSelect: vi.fn(),
        ...overrides,
    }
}

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Pinned so "next 14 days" is deterministic. 2026-05-11 is a Monday.
    vi.setSystemTime(new Date("2026-05-11T12:00:00Z"))
})

afterEach(() => {
    vi.useRealTimers()
})

function dateButtons() {
    // The date strip is the only place rendering a bare day number in a button.
    return screen.getAllByRole("button").filter((b) => /^\w{3}\d{1,2}\w{3}$/.test((b.textContent ?? "").replace(/\s+/g, "")))
}

describe("TimeSlotPicker - server-side rendering", () => {
    it("renders on the server without touching the DOM, and fetches nothing", () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal("fetch", fetchSpy)
        const html = renderToStaticMarkup(<TimeSlotPicker {...props()} />)
        expect(html).toContain("Select a date")
        // No date is selected server-side, so the time section must be absent entirely.
        expect(html).not.toContain("Select a time")
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("shows the empty-availability message instead of an empty strip", () => {
        const html = renderToStaticMarkup(
            <TimeSlotPicker {...props({ availability: ALL_DAYS.map((a) => ({ ...a, isEnabled: false })) })} />,
        )
        expect(html).toContain("No available dates")
        expect(html).not.toContain("Select a time")
    })
})

describe("TimeSlotPicker - selecting a date", () => {
    it("does not fetch until a date is clicked, then fetches for that date", async () => {
        const { pending, urls } = stubFetch()
        render(<TimeSlotPicker {...props()} />)
        expect(urls).toHaveLength(0)

        await act(async () => {
            dateButtons()[0].click()
        })

        expect(urls).toHaveLength(1)
        expect(urls[0]).toContain("profileId=p1")
        expect(urls[0]).toContain("serviceId=s1")
        expect(urls[0]).toMatch(/date=\d{4}-\d{2}-\d{2}/)
        await settle(pending[0], [])
    })

    it("shows the loading message until the booked-slot request settles", async () => {
        const { pending } = stubFetch()
        render(<TimeSlotPicker {...props()} />)

        await act(async () => {
            dateButtons()[0].click()
        })
        expect(screen.getByText("Loading available times...")).toBeTruthy()

        await settle(pending[0], [])
        expect(screen.queryByText("Loading available times...")).toBeNull()
    })

    it("renders one slot per duration window and hides the booked ones", async () => {
        const { pending } = stubFetch()
        render(<TimeSlotPicker {...props()} />)
        await act(async () => {
            dateButtons()[0].click()
        })
        // 09:00-11:00 in 60 minute steps is exactly 09:00 and 10:00.
        await settle(pending[0], ["09:00"])

        expect(screen.queryByRole("button", { name: "09:00" })).toBeNull()
        expect(screen.getByRole("button", { name: "10:00" })).toBeTruthy()
    })

    it("reports an empty date rather than an empty grid when every slot is booked", async () => {
        const { pending } = stubFetch()
        render(<TimeSlotPicker {...props()} />)
        await act(async () => {
            dateButtons()[0].click()
        })
        await settle(pending[0], ["09:00", "10:00"])
        expect(screen.getByText("No available slots on this date.")).toBeTruthy()
    })

    it("treats a failed request as 'nothing booked' rather than staying stuck loading", async () => {
        const { pending } = stubFetch()
        render(<TimeSlotPicker {...props()} />)
        await act(async () => {
            dateButtons()[0].click()
        })
        await act(async () => {
            pending[0].reject(new Error("offline"))
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(screen.queryByText("Loading available times...")).toBeNull()
        expect(screen.getByRole("button", { name: "09:00" })).toBeTruthy()
    })
})

describe("TimeSlotPicker - selecting a slot", () => {
    it("passes the selected date and the slot's own start and end to onSelect", async () => {
        const onSelect = vi.fn()
        const { pending, urls } = stubFetch()
        render(<TimeSlotPicker {...props({ onSelect })} />)
        await act(async () => {
            dateButtons()[0].click()
        })
        await settle(pending[0], [])
        const selectedDate = urls[0].split("date=")[1]

        await act(async () => {
            screen.getByRole("button", { name: "10:00" }).click()
        })

        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith({ date: selectedDate, startTime: "10:00", endTime: "11:00" })
    })

    it("clears the chosen slot when a different date is picked", async () => {
        const { pending } = stubFetch()
        const { container } = render(<TimeSlotPicker {...props()} />)
        await act(async () => {
            dateButtons()[0].click()
        })
        await settle(pending[0], [])
        await act(async () => {
            screen.getByRole("button", { name: "09:00" }).click()
        })
        const selectedClass = "bg-primary"
        expect(screen.getByRole("button", { name: "09:00" }).className).toContain(selectedClass)

        await act(async () => {
            dateButtons()[1].click()
        })
        await settle(pending[1], [])

        const grid = within(container).getByText("Select a time").parentElement as HTMLElement
        const stillSelected = Array.from(grid.querySelectorAll("button")).filter((b) =>
            b.className.includes(selectedClass),
        )
        expect(stillSelected).toHaveLength(0)
    })
})

/**
 * THE CASCADING-RENDER TEST - this is the one tied to the lint error at time-slot-picker.tsx:74.
 *
 * `setLoading(true)` runs synchronously in the effect body. The consequence is not cosmetic: when
 * the user picks a SECOND date, React commits a frame in which `selectedDate` is already the new
 * date while `bookedSlots` is still the PREVIOUS date's answer, because the effect that would have
 * flipped `loading` has not run yet. The user sees the new date's slot list filtered by the old
 * date's bookings - wrong availability, presented as fact.
 *
 * Asserting on the DOM after `act()` cannot see this; see tests/helpers/commits.tsx for why the
 * Profiler is used instead.
 */
describe("TimeSlotPicker - no stale availability frame when switching dates", () => {
    it("never commits a frame showing a new date's slots filtered by the previous date's bookings", async () => {
        const { pending } = stubFetch()
        const { container } = render(<div />)
        const { frames, Recorder } = recordCommits(container)
        const { rerender } = render(
            <Recorder>
                <TimeSlotPicker {...props()} />
            </Recorder>,
            { container },
        )
        void rerender

        // First date: 09:00 is booked, so only 10:00 is offered.
        await act(async () => {
            dateButtons()[0].click()
        })
        await settle(pending[0], ["09:00"])
        expect(screen.queryByRole("button", { name: "09:00" })).toBeNull()

        // Second date: nothing is booked, so BOTH slots should eventually be offered.
        const mark = frames.length
        await act(async () => {
            dateButtons()[1].click()
        })
        const duringSwitch = framesSince(frames, mark)

        // Every frame committed between the click and the request settling must be the loading
        // state. A frame that shows the time section without the loading message is a frame
        // asserting availability the component has not fetched yet.
        const lying = duringSwitch.filter((f) => f.includes("Select a time") && !f.includes("Loading available times"))
        expect(lying, `frames during date switch: ${JSON.stringify(duringSwitch)}`).toHaveLength(0)

        await settle(pending[1], [])
        expect(screen.getByRole("button", { name: "09:00" })).toBeTruthy()
        expect(screen.getByRole("button", { name: "10:00" })).toBeTruthy()
    })
})
