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


/**
 * Like `recordCommits`, but captures an arbitrary projection of the DOM on every commit instead of
 * just text content. Use it when the property under test involves attributes or form values, which
 * `textContent` does not include - for example "was the Save button enabled while the textarea still
 * held the previous record's text".
 *
 * The projection MUST run in the Profiler's onRender callback, not in a component body: a component
 * body runs in the render phase, before React has mutated the DOM, so it would observe the previous
 * commit and quietly pass.
 */
export function recordSnapshots<T>(project: () => T) {
    const snapshots: T[] = []
    function Recorder({ children }: { children: ReactNode }) {
        return (
            <Profiler
                id="snapshot-recorder"
                onRender={() => {
                    snapshots.push(project())
                }}
            >
                {children}
            </Profiler>
        )
    }
    return { snapshots, Recorder }
}
