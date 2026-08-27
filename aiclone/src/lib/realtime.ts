/**
 * In-process order event fan-out.
 *
 * `publish` is deliberately the only write path so it can later be swapped for
 * Redis pub/sub without touching callers. Everything here is per-process: a
 * multi-instance deployment needs that swap before staff boards agree.
 */

export type OrderStreamEvent = {
    /** `OrderEvent.seq` as a string, because it is a BigInt in the database. */
    seq: string
    orderId: string
    orderNumber: number
    kind: string
    from: string | null
    to: string
    at: string
    orderLineId: string | null
}

type Subscriber = (event: OrderStreamEvent) => void

type Hub = {
    byProfile: Map<string, Set<Subscriber>>
    byOrder: Map<string, Set<Subscriber>>
}

// Survives dev hot reloads, which otherwise orphan live subscribers.
const globalForRealtime = globalThis as unknown as { plOrderHub?: Hub }

function hub(): Hub {
    if (!globalForRealtime.plOrderHub) {
        globalForRealtime.plOrderHub = { byProfile: new Map(), byOrder: new Map() }
    }
    return globalForRealtime.plOrderHub
}

function attach(map: Map<string, Set<Subscriber>>, key: string, fn: Subscriber) {
    const existing = map.get(key)
    const set = existing ?? new Set<Subscriber>()
    set.add(fn)
    if (!existing) map.set(key, set)
    return () => {
        const current = map.get(key)
        if (!current) return
        current.delete(fn)
        if (current.size === 0) map.delete(key)
    }
}

function deliver(fn: Subscriber, event: OrderStreamEvent) {
    // One broken listener must not stop the rest of the fan-out.
    try {
        fn(event)
    } catch {
        // Ignored on purpose: the stream owner handles its own teardown.
    }
}

/** The single write path for live order events. */
export function publish(profileId: string, event: OrderStreamEvent) {
    const current = hub()
    const profileTargets = current.byProfile.get(profileId)
    if (profileTargets) for (const fn of [...profileTargets]) deliver(fn, event)
    const orderTargets = current.byOrder.get(event.orderId)
    if (orderTargets) for (const fn of [...orderTargets]) deliver(fn, event)
}

/** Staff board subscription, scoped to the profiles the caller owns. */
export function subscribeToProfiles(profileIds: string[], fn: Subscriber) {
    const detachers = [...new Set(profileIds)].map((id) => attach(hub().byProfile, id, fn))
    return () => {
        for (const detach of detachers) detach()
    }
}

/** Guest subscription, scoped to exactly one order. */
export function subscribeToOrder(orderId: string, fn: Subscriber) {
    return attach(hub().byOrder, orderId, fn)
}

/** Diagnostics only. */
export function realtimeStats() {
    const current = hub()
    const count = (map: Map<string, Set<Subscriber>>) =>
        [...map.values()].reduce((sum, set) => sum + set.size, 0)
    return {
        profileChannels: current.byProfile.size,
        orderChannels: current.byOrder.size,
        profileSubscribers: count(current.byProfile),
        orderSubscribers: count(current.byOrder),
    }
}
