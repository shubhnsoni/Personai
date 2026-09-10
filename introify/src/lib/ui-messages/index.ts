import type { UiLocale } from "../ui-locale"
import { en, type UiMessages } from "./en"
import { hi } from "./hi"

export type { UiMessages }

export const UI_MESSAGES: Record<UiLocale, UiMessages> = { en, hi }

export function messagesFor(locale: UiLocale): UiMessages {
    return UI_MESSAGES[locale] ?? UI_MESSAGES.en
}

export function t<K extends keyof UiMessages>(locale: UiLocale, ns: K): UiMessages[K] {
    return messagesFor(locale)[ns]
}
