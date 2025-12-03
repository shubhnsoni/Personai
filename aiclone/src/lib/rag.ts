import { ProfileDocument } from "@prisma/client"

interface ProfileWithRelations {
    displayName: string
    headline: string | null
    bio: string | null
    roleTemplate: string
    primaryGoal: string
    language: string
    welcomeMessageOverride: string | null
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
    }>
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
        'CUSTOM': 'Professional'
    }
    return roleMap[role] || 'Professional'
}

export function buildSystemPrompt(profile: ProfileWithRelations, contextDocs: ProfileDocument[]): string {
    const roleDescription = formatRoleTemplate(profile.roleTemplate)
    const goalDescription = formatGoal(profile.primaryGoal)

    let experienceSection = ""
    if (profile.workExperiences && profile.workExperiences.length > 0) {
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
    if (profile.projects && profile.projects.length > 0) {
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
    if (profile.serviceOfferings && profile.serviceOfferings.length > 0) {
        const serviceList = profile.serviceOfferings.map(s => {
            const price = s.isFree ? 'Free' : `$${(s.priceCents / 100).toFixed(0)}`
            let entry = `- ${s.name}: ${price} (${s.durationMinutes} min)`
            if (s.description) entry += ` - ${s.description}`
            return entry
        }).join('\n')
        servicesSection = `\n## Consultation Services\n${serviceList}`
    }

    let productsSection = ""
    if (profile.digitalProducts && profile.digitalProducts.length > 0) {
        const productList = profile.digitalProducts.map(p => {
            return `- ${p.title} (${p.type}): $${(p.priceCents / 100).toFixed(0)}${p.description ? ` - ${p.description}` : ''}`
        }).join('\n')
        productsSection = `\n## Digital Products\n${productList}`
    }

    let coursesSection = ""
    if (profile.courses && profile.courses.length > 0) {
        const courseList = profile.courses.map(c => {
            const lessonCount = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
            return `- ${c.title}: $${(c.priceCents / 100).toFixed(0)} (${c.modules.length} modules, ${lessonCount} lessons)${c.description ? ` - ${c.description}` : ''}`
        }).join('\n')
        coursesSection = `\n## Courses\n${courseList}`
    }

    let eventsSection = ""
    if (profile.events && profile.events.length > 0) {
        const upcomingEvents = profile.events.filter(e => new Date(e.startTime) > new Date())
        if (upcomingEvents.length > 0) {
            const eventList = upcomingEvents.map(e => {
                const date = new Date(e.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const price = e.isFree ? 'Free' : `$${(e.priceCents / 100).toFixed(0)}`
                return `- ${e.title} (${e.eventType}): ${date} - ${price}${e.description ? ` - ${e.description}` : ''}`
            }).join('\n')
            eventsSection = `\n## Upcoming Events\n${eventList}`
        }
    }

    let communitiesSection = ""
    if (profile.communities && profile.communities.length > 0) {
        const communityList = profile.communities.map(c => {
            const billing = c.billingCycle === 'MONTHLY' ? '/month' : c.billingCycle === 'YEARLY' ? '/year' : ' one-time'
            return `- ${c.name} (${c.platform}): $${(c.priceCents / 100).toFixed(0)}${billing}${c.description ? ` - ${c.description}` : ''}`
        }).join('\n')
        communitiesSection = `\n## Communities\n${communityList}`
    }

    let leadMagnetsSection = ""
    if (profile.leadMagnets && profile.leadMagnets.length > 0) {
        const magnetList = profile.leadMagnets.map(m => {
            return `- ${m.title} (Free ${m.type.toLowerCase()})${m.description ? ` - ${m.description}` : ''}`
        }).join('\n')
        leadMagnetsSection = `\n## Free Resources\n${magnetList}`
    }

    let contextSection = ""
    if (contextDocs.length > 0) {
        const contextText = contextDocs.map(d => {
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
${contextSection}

## Your Behavior Guidelines
- You speak in first person as ${profile.displayName}'s AI representative
- Your primary goal is to ${goalDescription}
- Be professional, friendly, and conversational
- Keep responses concise but informative (2-4 sentences typically)
- When asked about services, products, courses, or events, provide accurate information from the data above
- When asked about experience or projects, reference specific details from the data
- If you don't have specific information, say "I don't have that information available, but you can book a call to discuss" 
- Never make up information that isn't provided
- Use ${profile.language === 'en' ? 'English' : profile.language}
- When appropriate, guide the conversation toward the primary goal
- Help visitors discover products, courses, and events that might interest them
${profile.welcomeMessageOverride ? `\nWelcome message style: "${profile.welcomeMessageOverride}"` : ''}

## Tools Available
You have access to these functions that you should use when appropriate:
- collectLead: Use when the visitor shows interest in working together and provides their contact info
- showServices: Use when asked about consultation rates, booking calls, or coaching services
- showWorkExperience: Use when asked about background, CV, or work history
- showProjects: Use when asked about portfolio or past projects
- showProducts: Use when asked about digital products, ebooks, templates, or downloads for sale
- showCourses: Use when asked about courses, learning, or training programs
- showEvents: Use when asked about webinars, workshops, or upcoming events
- showCommunities: Use when asked about community memberships, Telegram, or Discord groups
- showLeadMagnets: Use when asked about free resources, guides, or giveaways

Remember: You are representing ${profile.displayName} professionally. Help visitors discover valuable content and services!`
}
