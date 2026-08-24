import { ProfileDocument } from "@prisma/client"
import { generateEmbedding, cosineSimilarity } from "@/lib/embeddings"
import { formatMoney, type DisplayCurrency } from "@/lib/pricing"
import { extrasOf, fieldOn, hasSurface } from "@/lib/surfaces"

export interface PersonalityConfig {
    tone?: "professional" | "casual" | "friendly" | "witty"
    customInstructions?: string
    responseLength?: "short" | "medium" | "long"
    language?: string
}

interface ProfileWithRelations {
    displayName: string
    headline: string | null
    bio: string | null
    roleTemplate: string
    primaryGoal: string
    language: string
    welcomeMessageOverride: string | null
    personalityConfig?: string | null
    aiModel?: string
    workExperiences: Array<{
        company: string
        role: string
        startDate: string
        endDate: string | null
        description: string | null
        achievements: string | null
    }>
    projects: Array<{
        title: string
        description: string | null
        client: string | null
        year: string | null
    }>
    serviceOfferings: Array<{
        name: string
        description: string | null
        priceCents: number
        isFree: boolean
        durationMinutes: number
    }>
    digitalProducts?: Array<{
        title: string
        description: string | null
        type: string
        priceCents: number
        fulfillment?: string | null
        stock?: number | null
        category?: string | null
        diet?: string | null
        spiceLevel?: number | null
        serveWindow?: string | null
    }>
    whatsapp?: string | null
    upiId?: string | null
    courses?: Array<{
        title: string
        description: string | null
        priceCents: number
        modules: Array<{ lessons: Array<unknown> }>
    }>
    events?: Array<{
        title: string
        description: string | null
        eventType: string
        startTime: Date
        priceCents: number
        isFree: boolean
    }>
    communities?: Array<{
        name: string
        description: string | null
        platform: string
        priceCents: number
        billingCycle: string
    }>
    leadMagnets?: Array<{
        title: string
        description: string | null
        type: string
    }>
}

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
    'there', 'then', 'once', 'my', 'your', 'his', 'her', 'its', 'our',
    'their', 'about', 'me', 'him', 'them', 'up', 'down', 'out', 'into'
])

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !STOP_WORDS.has(t))
}

function calculateBM25Score(
    query: string,
    document: string,
    avgDocLength: number = 100,
    k1: number = 1.5,
    b: number = 0.75
): number {
    const queryTerms = tokenize(query)
    const docTerms = tokenize(document)
    const docLength = docTerms.length

    if (docLength === 0) return 0

    const termFreq: Record<string, number> = {}
    for (const term of docTerms) {
        termFreq[term] = (termFreq[term] || 0) + 1
    }

    let score = 0
    for (const term of queryTerms) {
        const tf = termFreq[term] || 0
        if (tf > 0) {
            const idf = Math.log(1 + 1)
            const numerator = tf * (k1 + 1)
            const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength))
            score += idf * (numerator / denominator)
        }
    }

    return score
}

/**
 * Vector-based retrieval using OpenAI embeddings with cosine similarity.
 * Falls back to BM25 if embeddings are not available.
 */
export function scopeDocuments(documents: ProfileDocument[], visitorKey?: string | null) {
    return documents.filter((d) => {
        if (d.type === "VISITOR_MEMORY") return Boolean(visitorKey) && d.visitorKey === visitorKey
        return true
    })
}

export async function vectorRetrieval(query: string, documents: ProfileDocument[], topK: number = 3): Promise<ProfileDocument[]> {
    if (!query || documents.length === 0) return []

    // Check if any documents have embeddings
    const docsWithEmbeddings = documents.filter(d => d.embedding && d.embedding.length > 0)
    if (docsWithEmbeddings.length === 0) {
        // Fallback to BM25
        return simpleRetrieval(query, documents, topK)
    }

    try {
        const queryEmbedding = await generateEmbedding(query)

        const scored = docsWithEmbeddings.map(doc => ({
            doc,
            score: cosineSimilarity(queryEmbedding, doc.embedding)
        }))

        scored.sort((a, b) => b.score - a.score)
        return scored.filter(d => d.score > 0.3).slice(0, topK).map(d => d.doc)
    } catch (error) {
        console.error("Vector retrieval failed, falling back to BM25:", error)
        return simpleRetrieval(query, documents, topK)
    }
}

export function simpleRetrieval(query: string, documents: ProfileDocument[], topK: number = 3): ProfileDocument[] {
    if (!query || documents.length === 0) return []

    const avgDocLength = documents.reduce((sum, doc) => {
        const text = (doc.rawText || doc.title || "")
        return sum + tokenize(text).length
    }, 0) / documents.length || 100

    const scoredDocs = documents.map(doc => {
        const text = (doc.rawText || doc.title || "")
        const score = calculateBM25Score(query, text, avgDocLength)
        return { doc, score }
    })

    scoredDocs.sort((a, b) => b.score - a.score)

    return scoredDocs.filter(d => d.score > 0).slice(0, topK).map(d => d.doc)
}

function formatGoal(goal: string): string {
    const goalMap: Record<string, string> = {
        'BOOK_CALL': 'help visitors book a call with me',
        'COLLECT_LEADS': 'collect contact information from interested visitors',
        'SHOWCASE_WORK': 'showcase my work and portfolio',
        'SHOW_PORTFOLIO': 'showcase my work and portfolio',
        'HIRE_ME': 'help the visitor hire me or get an intro',
        'SELL_PRODUCTS': 'help visitors buy what is in stock',
        'TAKE_APPOINTMENTS': 'help visitors book an appointment',
        'BOOK_TABLE': 'help them reserve a table or pick from the menu',
        'ANSWER_QUESTIONS': 'answer questions about my expertise and services'
    }
    return goalMap[goal] || 'engage visitors and provide helpful information'
}

function formatRoleTemplate(role: string): string {
    const roleMap: Record<string, string> = {
        'DESIGNER': 'Product Designer',
        'CONSULTANT': 'Consultant',
        'COACH': 'Coach',
        'EDITOR': 'Editor',
        'DEVELOPER': 'Developer',
        'JOB_SEEKER': 'Professional',
        'SHOP': 'Shopkeeper',
        'RESTAURANT': 'Restaurant',
        'CA': 'Chartered Accountant',
        'CREATOR': 'Creator',
        'CUSTOM': 'Professional'
    }
    return roleMap[role] || 'Professional'
}

function buildPersonalitySection(personalityConfigStr?: string | null): string {
    if (!personalityConfigStr) return ""
    try {
        const config: PersonalityConfig = JSON.parse(personalityConfigStr)
        const parts: string[] = []

        if (config.tone) {
            const toneMap: Record<string, string> = {
                professional: "Maintain a professional and polished tone.",
                casual: "Be casual and relaxed in conversation, like talking to a friend.",
                friendly: "Be warm, approachable, and friendly in all responses.",
                witty: "Be clever, witty, and occasionally humorous while staying helpful."
            }
            parts.push(toneMap[config.tone] || "")
        }

        if (config.responseLength) {
            const lengthMap: Record<string, string> = {
                short: "Keep responses brief — 1-2 sentences when possible.",
                medium: "Keep responses moderate — 2-4 sentences typically.",
                long: "Provide detailed, thorough responses with multiple paragraphs when relevant."
            }
            parts.push(lengthMap[config.responseLength] || "")
        }

        if (config.language) {
            parts.push(`Respond in ${config.language}.`)
        }

        if (config.customInstructions) {
            parts.push(`\nAdditional instructions from the creator: ${config.customInstructions}`)
        }

        if (parts.length === 0) return ""
        return `\n## Personality & Style\n${parts.join("\n")}`
    } catch {
        return ""
    }
}

export function buildSystemPrompt(profile: ProfileWithRelations, contextDocs: ProfileDocument[], currency: DisplayCurrency = "USD"): string {
    const roleDescription = formatRoleTemplate(profile.roleTemplate)
    const goalDescription = formatGoal(profile.primaryGoal)
    const role = profile.roleTemplate
    const extras = extrasOf(profile)
    const showServices = hasSurface(role, "services", extras)
    const showShop = hasSurface(role, "shop", extras)
    const showCourses = hasSurface(role, "courses", extras)
    const showEvents = hasSurface(role, "events", extras)
    const showPortfolio = fieldOn(role, "portfolio", extras) || role === "CUSTOM"

    let experienceSection = ""
    if (showPortfolio && profile.workExperiences && profile.workExperiences.length > 0) {
        const expList = profile.workExperiences.map(e => {
            let entry = `- ${e.role} at ${e.company} (${e.startDate} - ${e.endDate || 'Present'})`
            if (e.description) entry += `\n  ${e.description}`
            if (e.achievements) {
                try {
                    const achievements = JSON.parse(e.achievements)
                    if (Array.isArray(achievements)) {
                        entry += '\n  Key achievements: ' + achievements.join(', ')
                    }
                } catch {
                    entry += `\n  Achievements: ${e.achievements}`
                }
            }
            return entry
        }).join('\n')
        experienceSection = `\n## Work Experience\n${expList}`
    }

    let projectsSection = ""
    if (showPortfolio && profile.projects && profile.projects.length > 0) {
        const projectList = profile.projects.map(p => {
            let entry = `- ${p.title}`
            if (p.client) entry += ` for ${p.client}`
            if (p.year) entry += ` (${p.year})`
            if (p.description) entry += `\n  ${p.description}`
            return entry
        }).join('\n')
        projectsSection = `\n## Projects & Portfolio\n${projectList}`
    }

    let servicesSection = ""
    if (showServices && profile.serviceOfferings && profile.serviceOfferings.length > 0) {
        const serviceList = profile.serviceOfferings.map(s => {
            const price = s.isFree ? 'Free' : formatMoney(s.priceCents, currency)
            let entry = `- ${s.name}: ${price} (${s.durationMinutes} min)`
            if (s.description) entry += ` - ${s.description}`
            return entry
        }).join('\n')
        servicesSection = `\n## Consultation Services\n${serviceList}`
    }

    let productsSection = ""
    if (showShop && profile.digitalProducts && profile.digitalProducts.length > 0) {
        const restaurant = profile.roleTemplate === "RESTAURANT"
        const productList = profile.digitalProducts.map(p => {
            const kind = p.fulfillment === "PHYSICAL" ? "physical" : p.fulfillment === "BOTH" ? "physical+digital" : p.type
            const stock =
                p.stock == null ? "" : p.stock <= 0 ? " — SOLD OUT" : ` — ${p.stock} in stock`
            const cat = p.category ? ` [${p.category}]` : ""
            const diet = p.diet ? ` · ${p.diet}` : ""
            const spice = p.spiceLevel ? ` · spice ${p.spiceLevel}/3` : ""
            const when = p.serveWindow && p.serveWindow !== "ALL" ? ` · ${p.serveWindow}` : ""
            return `- ${p.title}${cat} (${restaurant ? "dish" : kind}${diet}${spice}${when}): ${formatMoney(p.priceCents, currency)}${stock}${p.description ? ` - ${p.description}` : ""}`
        }).join('\n')
        productsSection = restaurant
            ? `\n## Menu\nNever invent a dish, price, or sold-out status. If they want to order, send them to the menu or WhatsApp. If they want a table, book it with bookTable after you have party size, date, and time.\n${productList}`
            : `\n## Shop\nNever invent stock. If sold out, say so. If they want to buy, send them to the shop or WhatsApp.\n${productList}`
        if (profile.whatsapp) productsSection += `\nWhatsApp: ${profile.whatsapp}`
        if (profile.upiId) productsSection += `\nUPI: ${profile.upiId}`
    }

    let coursesSection = ""
    if (showCourses && profile.courses && profile.courses.length > 0) {
        const courseList = profile.courses.map(c => {
            const lessonCount = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
            return `- ${c.title}: ${formatMoney(c.priceCents, currency)} (${c.modules.length} modules, ${lessonCount} lessons)${c.description ? ` - ${c.description}` : ''}`
        }).join('\n')
        coursesSection = `\n## Courses\n${courseList}`
    }

    let eventsSection = ""
    if (showEvents && profile.events && profile.events.length > 0) {
        const upcomingEvents = profile.events.filter(e => new Date(e.startTime) > new Date())
        if (upcomingEvents.length > 0) {
            const eventList = upcomingEvents.map(e => {
                const date = new Date(e.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const price = e.isFree ? 'Free' : formatMoney(e.priceCents, currency)
                return `- ${e.title} (${e.eventType}): ${date} - ${price}${e.description ? ` - ${e.description}` : ''}`
            }).join('\n')
            eventsSection = `\n## Upcoming Events\n${eventList}`
        }
    }

    let communitiesSection = ""
    if (showEvents && profile.communities && profile.communities.length > 0) {
        const communityList = profile.communities.map(c => {
            const billing = c.billingCycle === 'MONTHLY' ? '/month' : c.billingCycle === 'YEARLY' ? '/year' : ' one-time'
            return `- ${c.name} (${c.platform}): ${formatMoney(c.priceCents, currency)}${billing}${c.description ? ` - ${c.description}` : ''}`
        }).join('\n')
        communitiesSection = `\n## Communities\n${communityList}`
    }

    let leadMagnetsSection = ""
    if (fieldOn(role, "shopDigital", extras) && profile.leadMagnets && profile.leadMagnets.length > 0) {
        const magnetList = profile.leadMagnets.map(m => {
            return `- ${m.title} (Free ${m.type.toLowerCase()})${m.description ? ` - ${m.description}` : ''}`
        }).join('\n')
        leadMagnetsSection = `\n## Free Resources\n${magnetList}`
    }

    const visitorMemory = contextDocs.filter((d) => d.type === "VISITOR_MEMORY" && d.rawText)
    const otherDocs = contextDocs.filter((d) => d.type !== "VISITOR_MEMORY")
    let visitorSection = ""
    if (visitorMemory.length > 0) {
        visitorSection = `\n## What you already know about this visitor\n${visitorMemory.map((d) => d.rawText).join("\n")}\nUse this only for this visitor. Do not mention that you stored notes unless asked.`
    }

    let contextSection = ""
    if (otherDocs.length > 0) {
        const contextText = otherDocs.map(d => {
            if (d.rawText) return `### ${d.title}\n${d.rawText}`
            if (d.url) return `### ${d.title}\nLink: ${d.url}`
            return `### ${d.title}`
        }).join('\n\n')
        contextSection = `\n## Additional Context\n${contextText}`
    }

    return `You are the AI assistant representing ${profile.displayName}, a ${roleDescription}.

## About ${profile.displayName}
${profile.headline ? `Headline: ${profile.headline}` : ''}
${profile.bio ? `\nBio: ${profile.bio}` : ''}
${experienceSection}
${projectsSection}
${servicesSection}
${productsSection}
${coursesSection}
${eventsSection}
${communitiesSection}
${leadMagnetsSection}
${visitorSection}
${contextSection}

## How you format every reply
- Always write markdown a chat bubble can render. Never dump several items into one paragraph.
- Short paragraphs (1–2 sentences). Put a blank line between paragraphs.
- If you mention more than one service, product, course, price, or option, use a bullet list.
- Bold the name of each item, then price and one line of what it is:
  - **Fit call**: Free · 25 min — see if coaching is the right next step
- End with one clear next question on its own line.
- Do not use headings (#) or tables.

## Your Behavior Guidelines
- You speak in first person as ${profile.displayName}'s AI representative
- Your primary goal is to ${goalDescription}
- Be professional, friendly, and conversational
- When asked about services, products, courses, or events, provide accurate information from the data above
- When asked about experience or projects, reference specific details from the data
- If you don't have specific information, say "I don't have that information available, but you can book a call to discuss" 
- Never make up information that isn't provided
- Use ${profile.language === 'en' ? 'English' : profile.language}
- When appropriate, guide the conversation toward the primary goal
- Help visitors discover products, courses, and events that might interest them
${profile.welcomeMessageOverride ? `\nWelcome message style: "${profile.welcomeMessageOverride}"` : ''}
${buildPersonalitySection(profile.personalityConfig)}

## Tools Available
You have access to these functions that you should use when appropriate:
- collectLead: Use when the visitor shows interest and provides their contact info
${showServices ? "- showServices: Use when asked about rates, booking, or sessions\n" : ""}${showPortfolio ? "- showWorkExperience: Use when asked about background, CV, or work history\n- showProjects: Use when asked about portfolio or past projects\n" : ""}${showShop && role === "RESTAURANT" ? "- showMenu: Use when asked about the menu or dishes\n- bookTable: Use when they want to reserve a table. Never invent an empty table.\n" : ""}${showShop && role !== "RESTAURANT" ? "- showProducts: Use when asked about products or the shop\n" : ""}${showCourses ? "- showCourses: Use when asked about courses or training\n" : ""}${showEvents ? "- showEvents: Use when asked about events\n- showCommunities: Use when asked about groups\n" : ""}- showLeadMagnets: Use when asked about free resources, guides, or giveaways

Remember: You are representing ${profile.displayName} professionally. Help visitors discover valuable content and services!`
}
