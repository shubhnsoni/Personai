export { isHotelRole } from "./role"
export {
    HOTEL_STAFF_ROLES,
    HOTEL_DESK_SURFACES,
    hotelCanOpen,
    hotelCanWrite,
    hotelDesksForRole,
    hotelHrefSurface,
    hotelPathAllowed,
    hotelStaffLabel,
    isHotelStaffRole,
    mapWorkspaceRoleToHotel,
    parseHotelStaffJson,
    resolveHotelStaffRole,
    type HotelDeskSurface,
    type HotelStaffAssignment,
    type HotelStaffRole,
} from "./staff"
export { hotelNotifyPlan, hotelEmailCopy, filterHotelNotices, type HotelNotifyChannel, type HotelNotifyStep } from "./notifications"
export { parseHotelGroupJson, listHotelGroupMembers, type HotelGroupConfig, type HotelGroupHotel } from "./groups"
export { hotelHidesIntroifyChrome, hotelGuestPathsUnchanged } from "./white-label"
export {
    HOTEL_INTEGRATION_ADAPTERS,
    parseHotelIntegrations,
    hotelWebhookReady,
    stubPms,
    stubPos,
    stubWhatsApp,
    type HotelIntegrationStatus,
} from "./integrations"
export { hotelSetupChecklist, hotelConciergeIsLive, type HotelSetupItem } from "./setup"
export { normalizeRoomNumber, extractRoomNumber } from "./rooms"
export { hotelPropertyPath, hotelRoomPath, hotelStayPath, hotelQrPath, hotelQrTargetPath, isPublicChatViewportPath } from "./paths"
export {
    DEFAULT_HOUSEKEEPING_CATALOGUE,
    DEFAULT_SPA_CATALOGUE,
    DEFAULT_TRANSPORT_OPTIONS,
    DEFAULT_HOTEL_EXPERIENCES,
    DEFAULT_MAINTENANCE_CATALOGUE,
    HOTEL_SERVICE_OPTIONS,
    DEFAULT_HOTEL_SERVICES,
    defaultHousekeepingCatalogue,
    defaultSpaCatalogue,
    defaultTransportOptions,
    defaultHotelExperiences,
    defaultMaintenanceCatalogue,
} from "./catalogue"
export {
    HOTEL_REQUEST_STATUSES,
    HOTEL_REQUEST_TYPES,
    HOTEL_REQUEST_DESKS,
    nextHotelRequestStatus,
    hotelRequestStatusLabel,
    hotelRequestAdvanceLabel,
    parseHotelGuestIntent,
    departmentForType,
    catalogRequestItem,
    type HotelGuestIntent,
    type HotelRequestItem,
    type HotelRequestStatus,
    type HotelRequestType,
} from "./requests"
export { encodeHotelCard, parseHotelCard, stripHotelCard, type HotelActionCard } from "./cards"
export { hotelDeskReply, type HotelDeskContext, type HotelDeskResult } from "./desk"
export { hotelConciergeChips, hotelSuggestedReplies, type HotelConciergeChip } from "./chips"
export {
    hotelStayPhase,
    stayFeedbackTone,
    feedbackRoute,
    hotelGoogleReviewSearchUrl,
    type HotelStayPhase,
    type StayFeedbackTone,
} from "./stay"
export {
    HOTEL_KNOWLEDGE_BUCKETS,
    DEFAULT_HOTEL_KNOWLEDGE,
    DEFAULT_HOTEL_MAP_MARKERS,
    guestVisibleKnowledge,
    lookupHotelKnowledge,
    findMapMarker,
    parseHotelMapMarkers,
    type HotelKnowledgeDoc,
    type HotelMapMarker,
} from "./knowledge"
export { detectGuestLanguage, staffNoteFromGuest, guestMaintenanceCopy, guestEmergencyCopy, type HotelGuestLanguage } from "./language"
export {
    DEFAULT_HOTEL_SLA_MINUTES,
    slaBadge,
    summarizeHotelAnalytics,
    type HotelSlaBadge,
    type HotelAnalyticsSummary,
} from "./analytics"
export {
    DEFAULT_HOTEL_UPSELLS,
    shouldOfferUpsell,
    upsellCopy,
    firstUpsellLine,
    type HotelUpsell,
} from "./upsells"
