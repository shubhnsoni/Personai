export { isHotelRole } from "./role"
export { normalizeRoomNumber, extractRoomNumber } from "./rooms"
export { hotelPropertyPath, hotelRoomPath, hotelStayPath, hotelQrPath, hotelQrTargetPath } from "./paths"
export {
    DEFAULT_HOUSEKEEPING_CATALOGUE,
    DEFAULT_SPA_CATALOGUE,
    DEFAULT_TRANSPORT_OPTIONS,
    DEFAULT_HOTEL_EXPERIENCES,
    HOTEL_SERVICE_OPTIONS,
    DEFAULT_HOTEL_SERVICES,
    defaultHousekeepingCatalogue,
    defaultSpaCatalogue,
    defaultTransportOptions,
    defaultHotelExperiences,
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
export { hotelConciergeChips, type HotelConciergeChip } from "./chips"
export {
    hotelStayPhase,
    stayFeedbackTone,
    hotelGoogleReviewSearchUrl,
    type HotelStayPhase,
    type StayFeedbackTone,
} from "./stay"
