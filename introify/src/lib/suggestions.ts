export function generateSuggestions(lastAssistant: string, displayName: string): string[] {
    const t = (lastAssistant || "").toLowerCase()
    if (t.includes("book") || t.includes("call") || t.includes("session")) {
        return [`What does a first call with ${displayName} look like?`, "What should I prepare?", "Any openings this week?"]
    }
    if (t.includes("course") || t.includes("lesson") || t.includes("learn")) {
        return ["Who is that course for?", "How long does it take?", "Is there a starting module I can preview?"]
    }
    if (t.includes("product") || t.includes("workbook") || t.includes("download")) {
        return ["What's inside that file?", "Is it a one-time buy?", "Anything free to start with?"]
    }
    if (t.includes("event") || t.includes("workshop") || t.includes("office hour")) {
        return ["When is the next one?", "Is it live or recorded?", "Can I get a reminder?"]
    }
    if (t.includes("experience") || t.includes("background") || t.includes("work")) {
        return [`How did ${displayName} start?`, "Who do you usually work with?", "Can we book a fit call?"]
    }
    return [`Tell me more about working with ${displayName}`, "What should I do next?", "Do you have something free?"]
}
