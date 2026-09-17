import { describe, expect, it } from "vitest"
import { hotelRoomPathParts } from "@/lib/reserved-http"

describe("hotelRoomPathParts", () => {
  it("parses guest room paths", () => {
    expect(hotelRoomPathParts("/try-hotel/r/101")).toEqual({ slug: "try-hotel", room: "101" })
    expect(hotelRoomPathParts("/try-hotel/r/999")).toEqual({ slug: "try-hotel", room: "999" })
  })
  it("rejects non-room paths", () => {
    expect(hotelRoomPathParts("/try-hotel")).toBeNull()
    expect(hotelRoomPathParts("/dashboard/rooms")).toBeNull()
  })
})
