import { NextResponse } from "next/server"

import type {
  BusinessOsApiResponse,
  BusinessOsErrorCode,
} from "@/lib/business-os/contracts/errors"

const ERROR_STATUS: Record<BusinessOsErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
}

export function businessOsJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<BusinessOsApiResponse<T>>({ ok: true, data }, init)
}

export function businessOsError(
  code: BusinessOsErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json<BusinessOsApiResponse<never>>(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status: ERROR_STATUS[code] },
  )
}
