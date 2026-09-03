export type StoryCategory = "AMBIENCE" | "INTERIOR" | "FOOD" | "TEAM" | "EVENT"

export const STORY_CATEGORIES: StoryCategory[] = ["AMBIENCE", "INTERIOR", "FOOD", "TEAM", "EVENT"]

type StoryNouns = {
    verb: string
    AMBIENCE: string
    INTERIOR: string
    FOOD: string
    TEAM: string
    EVENT: string
}

const FALLBACK: StoryNouns = {
    verb: "the story",
    AMBIENCE: "Space",
    INTERIOR: "Studio",
    FOOD: "Craft",
    TEAM: "People",
    EVENT: "Moments",
}

const NOUNS: Record<string, StoryNouns> = {
    RESTAURANT: { verb: "the room", AMBIENCE: "Ambience", INTERIOR: "The room", FOOD: "The plate", TEAM: "People", EVENT: "Nights" },
    SHOP: { verb: "the shop", AMBIENCE: "Space", INTERIOR: "Floor", FOOD: "Craft", TEAM: "People", EVENT: "Drops" },
    JEWELRY_RETAIL: { verb: "the showroom", AMBIENCE: "Showroom", INTERIOR: "Counter", FOOD: "Pieces", TEAM: "People", EVENT: "Days" },
    JEWELRY_WHOLESALE: { verb: "the godown", AMBIENCE: "Godown", INTERIOR: "Lots", FOOD: "Parcels", TEAM: "People", EVENT: "Lifts" },
    DISTRIBUTOR: { verb: "the godown", AMBIENCE: "Godown", INTERIOR: "Racks", FOOD: "Cartons", TEAM: "People", EVENT: "Dispatches" },
    SALON_SPA: { verb: "the salon", AMBIENCE: "Room", INTERIOR: "Station", FOOD: "Treatments", TEAM: "People", EVENT: "Looks" },
    EVENTS_STUDIO: { verb: "the studio", AMBIENCE: "Venue", INTERIOR: "Setup", FOOD: "Work", TEAM: "Crew", EVENT: "Nights" },
    CONSULTANT: { verb: "the practice", AMBIENCE: "Space", INTERIOR: "Studio", FOOD: "Craft", TEAM: "People", EVENT: "Talks" },
    FIELD_SERVICE: { verb: "the crew", AMBIENCE: "Site", INTERIOR: "Van", FOOD: "Jobs", TEAM: "Crew", EVENT: "Calls" },
    REAL_ESTATE_BROKERAGE: { verb: "the office", AMBIENCE: "Neighbourhood", INTERIOR: "Interiors", FOOD: "Listings", TEAM: "People", EVENT: "Opens" },
    CREATOR: { verb: "the work", AMBIENCE: "Set", INTERIOR: "Studio", FOOD: "Work", TEAM: "People", EVENT: "Drops" },
    DESIGNER: { verb: "the work", AMBIENCE: "Space", INTERIOR: "Studio", FOOD: "Work", TEAM: "People", EVENT: "Shows" },
    JOB_SEEKER: { verb: "the background", AMBIENCE: "Space", INTERIOR: "Studio", FOOD: "Work", TEAM: "People", EVENT: "Moments" },
    RECRUITMENT_AGENCY: { verb: "the practice", AMBIENCE: "Space", INTERIOR: "Office", FOOD: "Roles", TEAM: "People", EVENT: "Intakes" },
}

function storyKit(role?: string | null): StoryNouns {
    const key = role === "DEVELOPER" || role === "EDITOR"
        ? "DESIGNER"
        : role === "CA" || role === "COACH"
            ? "CONSULTANT"
            : role || ""
    return NOUNS[key] || FALLBACK
}

export function storyPath(slug: string) {
    return `/${slug}/story`
}

export function storyLabel(role?: string | null) {
    return { chip: "About", page: "About", verb: storyKit(role).verb }
}

export function storyCategoryLabel(role: string | null | undefined, category: string) {
    const nouns = storyKit(role)
    if (category === "AMBIENCE" || category === "INTERIOR" || category === "FOOD" || category === "TEAM" || category === "EVENT") {
        return nouns[category]
    }
    return "Story"
}

export type StoryFrame = {
    id: string
    url: string
    title: string
    caption: string
    body: string
    category: StoryCategory
    sortOrder: number
    isPublished: boolean
}
