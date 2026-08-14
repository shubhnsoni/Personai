const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 20

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
        return { allowed: true, remaining: MAX_REQUESTS - 1 }
    }

    if (entry.count >= MAX_REQUESTS) {
        return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: MAX_REQUESTS - entry.count }
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitMap) {
        if (now > value.resetAt) rateLimitMap.delete(key)
    }
}, 5 * 60 * 1000)
