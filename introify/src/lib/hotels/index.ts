export { isHotelRole } from "./role"
export { normalizeRoomNumber, extractRoomNumber } from "./rooms"
export { hotelPropertyPath, hotelRoomPath, hotelStayPath, hotelQrPath, hotelQrTargetPath } from "./paths"
export {
    DEFAULT_HOUSEKEEPING_CATALOGUE,
    HOTEL_SERVICE_OPTIONS,
    DEFAULT_HOTEL_SERVICES,
    defaultHousekeepingCatalogue,
} from "./catalogue"
export {
    HOTEL_REQUEST_STATUSES,
    HOTEL_REQUEST_TYPES,
    nextHotelRequestStatus,
    hotelRequestStatusLabel,
    hotelRequestAdvanceLabel,
    parseHotelGuestIntent,
    departmentForType,
    type HotelGuestIntent,
    type HotelRequestItem,
    type HotelRequestStatus,
    type HotelRequestType,
} from "./requests"
export { encodeHotelCard, parseHotelCard, stripHotelCard, type HotelActionCard } from "./cards"
export { hotelDeskReply, type HotelDeskContext, type HotelDeskResult } from "./desk"
export { hotelConciergeChips, type HotelConciergeChip } from "./chips"
