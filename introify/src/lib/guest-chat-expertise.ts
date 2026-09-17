export type GuestChatExpertiseInput = {
    introductionCount: number
    showcaseCount: number
    frameworkCount?: number
    publicKnowledgeCount?: number
}

export type GuestChatExpertiseChrome = {
    showIntroduction: boolean
    showShowcase: boolean
    showFrameworks: boolean
    showKnowledge: boolean
}

/** Welcome-row chrome for the public guest chat. Knowledge and frameworks stay off this surface. */
export function guestChatExpertise(input: GuestChatExpertiseInput): GuestChatExpertiseChrome {
    return {
        showIntroduction: input.introductionCount > 0,
        showShowcase: input.showcaseCount > 0,
        showFrameworks: false,
        showKnowledge: false,
    }
}

export function guestChatHasExpertiseChrome(input: GuestChatExpertiseInput): boolean {
    const chrome = guestChatExpertise(input)
    return chrome.showIntroduction || chrome.showShowcase
}
