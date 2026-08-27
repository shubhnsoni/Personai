export type BusinessOsErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"

export type BusinessOsError = {
  code: BusinessOsErrorCode
  message: string
  details?: Record<string, unknown>
}

export type BusinessOsErrorResponse = {
  ok: false
  error: BusinessOsError
}

export type BusinessOsSuccessResponse<T> = {
  ok: true
  data: T
}

export type BusinessOsApiResponse<T> =
  | BusinessOsSuccessResponse<T>
  | BusinessOsErrorResponse
