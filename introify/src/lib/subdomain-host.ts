const SKIP = /^\/(api|_next|uploads|sign-in|sign-up|dashboard|onboarding|admin|qa|library|l\/|o\/|favicon\.ico)/i

export function tenantFromHost(hostHeader: string, apexHostname: string): string | null {
    const host = hostHeader.split(":")[0].toLowerCase()
    const apex = apexHostname.split(":")[0].toLowerCase().replace(/^www\./, "")
    if (!host || !apex) return null
    if (host === apex || host === `www.${apex}`) return null
    if (host.endsWith(`.${apex}`)) {
        const sub = host.slice(0, -(apex.length + 1))
        if (!sub || sub.includes(".")) return null
        return sub
    }
    return null
}

export function subdomainRoute(pathname: string, tenant: string): { type: "skip" } | { type: "redirect"; pathname: string } | { type: "rewrite"; pathname: string } {
    if (!tenant || SKIP.test(pathname)) return { type: "skip" }
    const prefix = `/${tenant}`
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        const next = pathname.slice(prefix.length) || "/"
        return { type: "redirect", pathname: next }
    }
    const rest = pathname === "/" ? "" : pathname
    return { type: "rewrite", pathname: `${prefix}${rest}` }
}
