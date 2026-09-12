import { SelectedBrand } from "./selected-brand"

interface IntroifyWordmarkProps {
    className?: string
    decorative?: boolean
    animated?: boolean
}

/** The approved, immutable Option 9 site wordmark. */
export function IntroifyWordmark(props: IntroifyWordmarkProps) {
    return <SelectedBrand {...props} />
}
