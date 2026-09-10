"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
    UI_LOCALE_COOKIE,
    isShippedUiLocale,
    localeSwitchPath,
    parseUiLocale,
    uiLocaleCookieOptions,
} from "@/lib/ui-locale"

export async function setUiLocaleAction(formData: FormData) {
    const locale = parseUiLocale(String(formData.get("lang") || ""))
    if (!locale || !isShippedUiLocale(locale)) return
    const jar = await cookies()
    jar.set(UI_LOCALE_COOKIE, locale, uiLocaleCookieOptions())
    redirect(localeSwitchPath(String(formData.get("next") || "/"), locale))
}
