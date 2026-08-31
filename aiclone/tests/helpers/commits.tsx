import { Profiler, type ReactNode } from "react"

/**
 * A commit recorder.
 *
 * WHY THIS EXISTS
 * ---------------
 * `react-hooks/set-state-in-effect` is a *cascading render* rule: the defect it names is that an
 * effect body calls setState, so React commits one render with the pre-effect state and then
 * immediately commits a second one. The user-visible symptom is a flash of wrong output.
 *
 * That intermediate commit is invisible to ordinary assertions, because @testing-library wraps
 * interactions in `act()` and `act()` does not return until every queued effect and re-render has
 * flushed - by which time the DOM only shows the FINAL state. So a test that only inspects the DOM
 * after `act()` literally cannot tell a cascading render from a clean one, and could never fail
 * before a set-state-in-effect fix.
 *
 * `<Profiler onRender>` is called during the commit phase, after React has mutated the DOM for
 * that commit. Capturing `container.textContent` there gives one string per commit, which is
 * exactly the sequence of frames a user would have seen. That makes "there was a frame showing
 * stale data" a directly assertable claim.
 */
export function recordCommits(container: HTMLElement) {
    const frames: string[] = []
    function Recorder({ children }: { children: ReactNode }) {
        return (
            <Profiler
                id="recorder"
                onRender={() => {
                    frames.push(container.textContent ?? "")
                }}
            >
                {children}
            </Profiler>
        )
    }
    return { frames, Recorder }
}

/** Frames committed since a marker index, useful for "what happened during this interaction". */
export function framesSince(frames: string[], mark: number) {
    return frames.slice(mark)
}
