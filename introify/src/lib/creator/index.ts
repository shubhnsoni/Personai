export {
    CREATOR_GUEST_MENU_LABEL_PORTFOLIO,
    CREATOR_GUEST_MENU_LABEL_WORK,
    CREATOR_GUEST_MENU_EMPTY_TITLE,
    CREATOR_GUEST_MENU_EMPTY_DETAIL,
    SHOP_OWNER_EMPTY_CTA,
    SHOP_GUEST_EMPTY_TITLE,
    isCreatorPortfolioMenuRole,
    creatorGuestMenuLabel,
    creatorGuestMenuEmptyCopy,
    shopCatalogGuestEmptyCopy,
} from "./guest-menu"

export {
    CREATOR_SHOWCASE,
    CREATOR_DISCOVERY_ALIAS_MAP,
    CREATOR_DISCOVERY_ALIASES,
    CREATOR_DISCOVERY_REQUIRED_ALIASES,
    creatorDiscoveryRedirects,
    isCreatorDiscoveryAlias,
    creatorDiscoveryDestinationSlug,
    creatorDiscoveryDestinationForPath,
    isCreatorDiscoveryShowcaseSlug,
} from "./discovery-aliases"
export type {
    CreatorDiscoveryAlias,
    CreatorDiscoveryRedirect,
} from "./discovery-aliases"

export {
    CREATOR_GUEST_BOOK_LABEL,
    CREATOR_GUEST_BOOK_EMPTY_TITLE,
    CREATOR_GUEST_BOOK_EMPTY_DETAIL,
    CREATOR_GUEST_BOOK_FORBIDDEN_COPY,
    isCreatorLeadBookSurface,
    creatorGuestBookLabel,
    shouldUseCreatorLeadBookEmpty,
    creatorGuestBookEmptyCopy,
    creatorBookCopyLooksLikeSessions,
} from "./guest-book"
