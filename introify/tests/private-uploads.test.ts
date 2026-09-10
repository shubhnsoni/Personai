// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
    privateUploadsDirectory,
    signPrivateUpload,
    verifyPrivateUpload,
} from "@/lib/private-uploads"
import { confidentialUploadsEnabled } from "@/lib/private-upload-policy"

describe("private uploads", () => {
    it("keeps confidential collection disabled until private storage is verified in production", () => {
        expect(confidentialUploadsEnabled()).toBe(false)
    })

    it("stores private files outside the public uploads directory", () => {
        expect(privateUploadsDirectory("/app", "/var/private")).toMatch(/private$/)
        expect(privateUploadsDirectory("/app")).toMatch(/private-uploads$/)
        expect(privateUploadsDirectory("/app")).not.toMatch(/public[\\/]uploads/)
    })

    it("authorizes a signed path and rejects a foreign or expired token", () => {
        const token = signPrivateUpload({ path: ["rx", "note.png"], secret: "test-secret", nowMs: 1_000, ttlSeconds: 60 })
        expect(verifyPrivateUpload({ token, path: ["rx", "note.png"], secret: "test-secret", nowMs: 1_000 })).toBe(true)
        expect(verifyPrivateUpload({ token, path: ["rx", "other.png"], secret: "test-secret", nowMs: 1_000 })).toBe(false)
        expect(verifyPrivateUpload({ token, path: ["rx", "note.png"], secret: "test-secret", nowMs: 70_000 })).toBe(false)
    })
})
