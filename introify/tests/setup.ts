import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

/**
 * Global test setup.
 *
 * `cleanup()` unmounts every tree rendered by @testing-library/react after each test. Without it
 * a component whose effect chain is still pending would keep running timers into the next test,
 * which is exactly the class of bug this suite exists to catch - so leaking it would make the
 * suite dishonest.
 *
 * `IS_REACT_ACT_ENVIRONMENT` is the flag React 19 looks for before it will honour `act()`. RTL
 * sets it around its own helpers, but several tests here call `act()` from "react" directly to
 * control when effects and promise callbacks flush; without this they warn on every call and,
 * worse, React would be free to batch differently than in the assertions.
 *
 * DELIBERATELY NOT DONE HERE: no global `window.matchMedia` polyfill. jsdom does not implement
 * matchMedia, and that is useful. Components in this repository call it during effects, and a
 * blanket polyfill would silently answer "no preference" for every test and hide both the
 * "component crashes when matchMedia is missing" case and the "component ignores a change event"
 * case. Each test installs the matchMedia it needs, and says so.
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
    cleanup()
})
