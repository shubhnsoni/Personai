export function guestDeskReply(
    query: string,
    profile: { displayName: string; headline?: string | null; bio?: string | null },
) {
    const name = profile.displayName
    const headline = (profile.headline || "").trim()
    const bio = (profile.bio || "").trim()
    const first = bio.split(/\n+/).map((line) => line.trim()).filter(Boolean)[0] || ""
    const text = query.toLowerCase().trim()

    if (/^(hi|hello|hey|namaste)\b/.test(text) || text === "hi") {
        return headline
            ? `Hi — I’m ${name}’s assistant on this page. ${name} is ${headline}. Ask about their work, or book an intro.`
            : `Hi — I’m ${name}’s assistant on this page. Ask about their work, or book an intro.`
    }
    if (/(where|from|based|live|city)/.test(text) && /bengaluru|bangalore/i.test(`${bio} ${headline}`)) {
        return `${name} is based in Bengaluru, Karnataka, India.`
    }
    if (/(about|who is|who are)/.test(text) && (first || headline)) {
        return [headline && `${name} — ${headline}.`, first].filter(Boolean).join(" ")
    }
    if (first) return first
    if (headline) return `${name} — ${headline}.`
    return `This is ${name}’s page. Ask about their work.`
}
