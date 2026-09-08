/**
 * External provider adapters for appointments — deliberately inert by default.
 *
 * WHY THIS EXISTS AS A SEPARATE, INJECTED LAYER
 * Deposits touch money and reminders touch a customer's inbox or phone. Neither may fire
 * from this codebase yet. Rather than leaving a TODO where a Stripe or Twilio call would
 * go, the capability is modelled as an interface with an inert default, so:
 *
 *   1. Production wiring cannot accidentally acquire a live provider — it must be passed
 *      one explicitly.
 *   2. A harness can assert, by counting invocations, that no provider was touched on a
 *      refusal path. "We didn't call Stripe" becomes a measurable claim instead of a
 *      promise.
 *
 * An accepted operation may only produce a QUEUED INTERNAL RECORD. Nothing here performs
 * network I/O, and there is no code path that can.
 */

export type DepositAuthorizationRequest = Readonly<{
    bookingId: string
    profileId: string
    amountCents: number
    currency: string
    idempotencyKey: string | null
}>

export type DepositAuthorizationResult = Readonly<{
    outcome: "authorized" | "failed" | "unavailable"
    providerRef: string | null
    failureCode: string | null
}>

export type ReminderDispatchRequest = Readonly<{
    reminderId: string
    bookingId: string
    profileId: string
    channel: "EMAIL" | "SMS" | "WHATSAPP"
    sendAt: Date
}>

export type ReminderDispatchResult = Readonly<{
    outcome: "sent" | "failed" | "unavailable"
    failureCode: string | null
}>

export interface PaymentProvider {
    authorizeDeposit(request: DepositAuthorizationRequest): Promise<DepositAuthorizationResult>
    captureDeposit(request: DepositAuthorizationRequest): Promise<DepositAuthorizationResult>
    refundDeposit(request: DepositAuthorizationRequest): Promise<DepositAuthorizationResult>
}

export interface NotificationProvider {
    dispatch(request: ReminderDispatchRequest): Promise<ReminderDispatchResult>
}

/**
 * The default payment provider. Performs no network call and cannot: it reports
 * `unavailable` so callers must treat the deposit as still pending rather than assuming
 * success. Every invocation is counted so tests can assert it was never reached.
 */
export class UnconfiguredPaymentProvider implements PaymentProvider {
    calls = 0

    private unavailable(): DepositAuthorizationResult {
        this.calls += 1
        return Object.freeze({
            outcome: "unavailable" as const,
            providerRef: null,
            failureCode: "PROVIDER_NOT_CONFIGURED",
        })
    }

    async authorizeDeposit(): Promise<DepositAuthorizationResult> {
        return this.unavailable()
    }

    async captureDeposit(): Promise<DepositAuthorizationResult> {
        return this.unavailable()
    }

    async refundDeposit(): Promise<DepositAuthorizationResult> {
        return this.unavailable()
    }
}

/**
 * The default notification provider. Performs no send. A reminder handed to it is left
 * SCHEDULED rather than marked SENT, so the ledger never claims a delivery that did not
 * happen.
 */
export class UnconfiguredNotificationProvider implements NotificationProvider {
    calls = 0

    async dispatch(): Promise<ReminderDispatchResult> {
        this.calls += 1
        return Object.freeze({ outcome: "unavailable" as const, failureCode: "PROVIDER_NOT_CONFIGURED" })
    }
}

export type AppointmentProviders = Readonly<{
    payments: PaymentProvider
    notifications: NotificationProvider
}>

export function unconfiguredProviders(): AppointmentProviders {
    return Object.freeze({
        payments: new UnconfiguredPaymentProvider(),
        notifications: new UnconfiguredNotificationProvider(),
    })
}
