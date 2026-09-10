"use client"

import { Languages } from "lucide-react"
import { setUiLocaleAction } from "@/app/actions/ui-locale"
import {
    SHIPPED_UI_LOCALES,
    UI_LOCALE_NATIVE_NAME,
    type UiLocale,
} from "@/lib/ui-locale"

export function LanguageSwitcher({
    locale,
    label,
}: {
    locale: UiLocale
    label: string
}) {
    return (
        <form
            className="mk-language"
            action={setUiLocaleAction}
            onSubmit={event => {
                const next = event.currentTarget.elements.namedItem("next")
                if (next instanceof HTMLInputElement) {
                    next.value = `${window.location.pathname}${window.location.search}`
                }
            }}
        >
            <input type="hidden" name="next" value="/" />
            <Languages size={16} aria-hidden="true" />
            <select
                name="lang"
                aria-label={label}
                defaultValue={locale}
                key={locale}
                onChange={event => event.currentTarget.form?.requestSubmit()}
            >
                {SHIPPED_UI_LOCALES.map(code => (
                    <option key={code} value={code} lang={code === "hi" ? "hi" : "en"}>
                        {UI_LOCALE_NATIVE_NAME[code]}
                    </option>
                ))}
            </select>
        </form>
    )
}
