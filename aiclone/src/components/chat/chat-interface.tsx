"use client"
import {
    useState,
    useRef,
    useEffect,
    useCallback,
    useSyncExternalStore,
    type ReactNode,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import { ArrowUp, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatAvatar } from "@/components/chat/chat-avatar"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { ORB_THEMES, resolveOrbVariant } from "@/lib/orb-variants"
import { toast } from "sonner"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    senderType?: string
}

export type ChatChip = {
    id: string
    label: string
    highlighted?: boolean
    icon?: ReactNode
    /** Send this as a visitor message. Ignored when onSelect is set. */
    prompt?: string
    onSelect?: () => void
    href?: string
}

interface ChatInterfaceProps {
    profile: {
        id: string
        displayName: string
        welcomeMessageOverride?: string | null
        slug: string
        imageUrl?: string | null
        chatAvatarMode?: string | null
        roleTemplate?: string | null
    }
    welcome?: ReactNode
    chips?: ChatChip[]
    topics?: string[]
    quickQuestions?: string[]
    onShowContent?: (type: "about" | "experience" | "projects" | "services" | "products" | "courses" | "events" | "communities") => void
    colors?: string[]
    animationConfig?: { speed?: number; intensity?: number; variant?: string; look?: string; skin?: string; shape?: string; expression?: string; color?: string }
    isPanelOpen?: boolean
    onIntroStage?: (stage: "hi" | "type" | "orb" | "ready") => void
}

type RichContentType = "experience" | "projects" | "about" | "services" | "products" | "courses" | "events" | "communities"

export function ChatInterface({
    profile,
    chips = [],
    topics = [],
    quickQuestions = [],
    onShowContent,
    colors = [],
    animationConfig = {},
    onIntroStage,
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [inputFocused, setInputFocused] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [visitorId, setVisitorId] = useState<string | null>(null)
    const [, setIsLoadingHistory] = useState(true)
    const [introReady, setIntroReady] = useState(false)
    const [chatMode, setChatMode] = useState("AI")
    const [liveChatEnabled, setLiveChatEnabled] = useState(false)
    const [isMember, setIsMember] = useState(false)
    const [slaMinutes, setSlaMinutes] = useState(10)
    const [queuePosition, setQueuePosition] = useState(1)
    const [, setLiveRequestedAt] = useState<string | null>(null)
    const [streamSuggestions, setStreamSuggestions] = useState<string[]>([])
    const [orbReact, setOrbReact] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const chipLock = useRef(false)

    const orbColors = colors.length >= 2 ? (colors as [string, string]) : undefined
    const orbTheme = ORB_THEMES[resolveOrbVariant(colors, animationConfig.variant)]

    useEffect(() => {
        fetch(`/api/conversations?profileId=${profile.id}`, { credentials: "include" })
            .then((res) => res.json())
            .then((data) => {
                if (data.visitorId) {
                    setVisitorId(data.visitorId)
                    localStorage.setItem(`personalink_visitor_${profile.id}`, data.visitorId)
                }
                setLiveChatEnabled(Boolean(data.liveChatEnabled))
                setIsMember(Boolean(data.isMember))
                setSlaMinutes(data.slaMinutes || 10)
                setQueuePosition(data.queuePosition || 1)
                setChatMode("AI")
                setLiveRequestedAt(null)
                if (data.conversationId) setConversationId(data.conversationId)
            })
            .catch(() => {})
            .finally(() => setIsLoadingHistory(false))
    }, [profile.id])

    useEffect(() => {
        if (chatMode !== "LIVE" && chatMode !== "LIVE_REQUESTED") return
        const tick = setInterval(() => {
            fetch(`/api/conversations?profileId=${profile.id}`, { credentials: "include" })
                .then((res) => res.json())
                .then((data) => {
                    setChatMode(data.mode || "AI")
                    setQueuePosition(data.queuePosition || 1)
                    setLiveRequestedAt(data.liveRequestedAt || null)
                    if (data.messages) setMessages(data.messages)
                    if (data.conversationId) setConversationId(data.conversationId)
                })
                .catch(() => {})
        }, 2500)
        return () => clearInterval(tick)
    }, [chatMode, profile.id])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isLoading])

    const restaurant = profile.roleTemplate === "RESTAURANT"
    const getRichContent = (content: string): RichContentType | null => {
        const lower = content.toLowerCase()
        if (lower.includes("consultation services") || lower.includes("would you like to book")) return "services"
        if (lower.includes("work experience") || lower.includes("work history")) return "experience"
        if (lower.includes("project") || lower.includes("portfolio")) return "projects"
        if (lower.includes("about") || lower.includes("who is")) return "about"
        if (!restaurant && (lower.includes("digital products") || lower.includes("would you like to purchase"))) return "products"
        if (lower.includes("courses") || lower.includes("would you like to enroll")) return "courses"
        if (lower.includes("upcoming events") || lower.includes("would you like to register")) return "events"
        if (lower.includes("communities") || lower.includes("would you like to join")) return "communities"
        return null
    }

    const sendMessage = useCallback(async (messageContent: string) => {
        if (!messageContent.trim() || isLoading) return

        abortControllerRef.current?.abort()
        abortControllerRef.current = new AbortController()

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: messageContent
        }

        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        setInput("")
        setIsLoading(true)

        const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "",
            senderType: chatMode === "LIVE" ? "OWNER" : "AI",
        }

        setMessages([...newMessages, assistantMessage])

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    profileId: profile.id,
                    conversationId,
                    visitorId
                }),
                signal: abortControllerRef.current.signal
            })

            if (response.status === 429) {
                throw new Error("rate_limit")
            }
            if (response.status === 503) {
                const data = await response.json()
                if (data.error === "ai_not_configured") {
                    throw new Error("ai_not_configured")
                }
            }
            if (!response.ok) throw new Error("Chat request failed")

            const newConversationId = response.headers.get("X-Conversation-Id")
            if (newConversationId && !conversationId) {
                setConversationId(newConversationId)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error("No response body")

            const decoder = new TextDecoder()
            let fullContent = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split("\n").filter(Boolean)

                for (const line of lines) {
                    if (line.startsWith('0:"')) {
                        const content = line.slice(3, -1)
                            .replace(/\\n/g, "\n")
                            .replace(/\\"/g, '"')
                        fullContent += content

                        setMessages(prev => {
                            const updated = [...prev]
                            const lastIdx = updated.length - 1
                            if (updated[lastIdx]?.role === "assistant") {
                                updated[lastIdx] = { ...updated[lastIdx], content: fullContent }
                            }
                            return updated
                        })
                    } else if (line.startsWith("d:")) {
                        try {
                            const extra = JSON.parse(line.slice(2))
                            if (Array.isArray(extra.suggestions)) setStreamSuggestions(extra.suggestions)
                        } catch { /* ignore */ }
                    }
                }
            }
        } catch (error) {
            if ((error as Error).name === "AbortError") return
            console.error("Chat error:", error)

            const errorMsg = (error as Error).message
            const isRateLimit = errorMsg === "rate_limit"
            const isAiNotConfigured = errorMsg === "ai_not_configured"
            toast.error(
                isRateLimit ? "Slow down!" : isAiNotConfigured ? "AI Chat Coming Soon" : "Connection issue",
                {
                    description: isRateLimit
                        ? "Too many messages. Please wait a moment."
                        : isAiNotConfigured
                        ? "AI chat hasn't been set up yet. Check back later!"
                        : "Having trouble connecting. Please try again.",
                }
            )

            setMessages(prev => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                if (updated[lastIdx]?.role === "assistant" && !updated[lastIdx].content) {
                    updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: isAiNotConfigured
                            ? "🚀 AI chat is coming soon! The creator is still setting things up."
                            : "I'm having trouble responding right now. Please try again."
                    }
                }
                return updated
            })
        } finally {
            setIsLoading(false)
        }
    }, [messages, profile.id, conversationId, visitorId, isLoading, chatMode])

    const handleSubmit = (e?: React.FormEvent, overrideInput?: string) => {
        e?.preventDefault()
        const messageToSend = overrideInput || input
        sendMessage(messageToSend)
    }

    const playMouthThen = (fn: () => void) => {
        if (chipLock.current) return
        chipLock.current = true
        setOrbReact((n) => n + 1)
        const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
        window.setTimeout(() => {
            chipLock.current = false
            fn()
        }, reduce ? 0 : 420)
    }

    const handleChip = (chip: ChatChip) => {
        playMouthThen(() => {
            if (chip.href) {
                window.open(chip.href, chip.href.startsWith("http") ? "_blank" : "_self")
                return
            }
            if (chip.onSelect) {
                chip.onSelect()
                return
            }
            if (chip.prompt) {
                sendMessage(chip.prompt)
                return
            }
            inputRef.current?.focus()
        })
    }

    const hasStarted = messages.length > 0
    const typingGaze = inputFocused || input.length > 0
        ? {
            x: input.length === 0
                ? -0.72
                : Math.min(0.92, -0.78 + (Math.min(input.length, 28) / 28) * 1.7),
            y: -0.92,
        }
        : null
    const lastMsg = messages[messages.length - 1]
    const orbMood =
        isLoading && lastMsg?.role === "assistant" && lastMsg.content
            ? "speaking"
            : isLoading
                ? "thinking"
                : input.length > 0
                    ? "listening"
                    : "idle"
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant" && m.content)
    const suggestionPrompts = hasStarted
        ? (streamSuggestions.length > 0
            ? streamSuggestions
            : contextualSuggestions(profile.displayName, lastAssistant ? getRichContent(lastAssistant.content) : null))
        : []
    const primaryChip = chips.find(c => c.highlighted) ?? chips[0]
    const emptyChips = chips.length > 0
        ? chips
        : quickQuestions.map((q, i) => ({ id: `q-${i}`, label: q, prompt: q }))

    return (
        <div
            className="flex flex-col h-full w-full relative text-profile-text"
            style={{
                ["--pl-orb-from" as string]: orbTheme.bright,
                ["--pl-orb-to" as string]: orbTheme.deep,
                ["--pl-aurora" as string]: orbTheme.accent,
                ["--pl-brand-foreground" as string]: orbTheme.onAccent,
                ["--profile-ring" as string]: `${orbTheme.accent}99`,
                ["--chat-accent" as string]: orbTheme.accent,
                ["--chat-on-accent" as string]: orbTheme.onAccent,
            }}
        >
            {hasStarted && (
                <div className="shrink-0 z-20 px-3 py-2 flex items-center gap-2 border-b border-black/5 min-w-0 dark:border-white/5 sm:px-6">
                    <ChatAvatar
                        size={36}
                        name={profile.displayName}
                        imageUrl={profile.imageUrl}
                        mode={profile.chatAvatarMode}
                        colors={orbColors}
                        variant={animationConfig.variant}
                        look={animationConfig.look}
                        skin={animationConfig.skin}
                        shape={animationConfig.shape}
                        expression={animationConfig.expression}
                        color={animationConfig.color}
                        speed={animationConfig.speed}
                        intensity={animationConfig.intensity}
                        gaze={typingGaze}
                        mood={orbMood}
                        reactToken={orbReact}
                    />
                    <span className="font-semibold text-ui text-profile-text truncate min-w-0">
                        {profile.displayName}&apos;s AI
                    </span>
                    {primaryChip && (
                        <Chip
                            className="ml-auto shrink-0"
                            variant="profile"
                            size="sm"
                            highlighted={primaryChip.highlighted}
                            icon={primaryChip.icon}
                            label={primaryChip.label}
                            onClick={() => handleChip(primaryChip)}
                        />
                    )}
                </div>
            )}

            <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto scroll-smooth"
            >
                <div className={cn(hasStarted ? "mx-auto w-full max-w-3xl px-3 py-3 space-y-5 sm:px-6 sm:py-4 sm:space-y-8" : "h-full")}>
                {!hasStarted && (
                    <WelcomeIntro
                        name={profile.displayName}
                        welcome={profile.welcomeMessageOverride}
                        topics={topics}
                        chips={emptyChips}
                        onChip={handleChip}
                        orb={
                            <ChatAvatar
                                size={168}
                                name={profile.displayName}
                                colors={orbColors}
                                variant={animationConfig.variant}
                                look={animationConfig.look}
                                skin={animationConfig.skin}
                                shape={animationConfig.shape}
                                expression={animationConfig.expression}
                                color={animationConfig.color}
                                speed={animationConfig.speed}
                                intensity={animationConfig.intensity}
                                mood="greeting"
                                reactToken={orbReact}
                            />
                        }
                        accent={orbTheme.accent}
                        bare={animationConfig.look === "pixel" || animationConfig.look === "bloub" || animationConfig.look === "blob"}
                        onReady={() => setIntroReady(true)}
                        onStage={onIntroStage}
                    />
                )}

                {messages.map((m, i) => {
                    const richContentType = m.role !== 'user' ? getRichContent(m.content) : null
                    const isUser = m.role === 'user'
                    const lastHostIndex = messages.reduce((acc, msg, idx) => (msg.role !== "user" ? idx : acc), -1)
                    const isLastHost = !isUser && i === lastHostIndex
                    const isOwner = m.senderType === "OWNER" || (isLastHost && chatMode === "LIVE")
                    const isLiveHost = isLastHost && isOwner
                    const typing = isLastHost && !m.content

                    return (
                        <div
                            key={m.id}
                            className={cn(
                                "flex w-full min-w-0 animate-in fade-in slide-in-from-bottom-2",
                                isUser ? "justify-end" : "justify-start"
                            )}
                        >
                            <div className={cn(
                                "flex min-w-0 items-end gap-2",
                                "max-w-[88%]"
                            )}>
                                {!isUser && (isLastHost ? (
                                    <div className="mb-0.5 shrink-0">
                                        {isLiveHost ? (
                                            profile.imageUrl ? (
                                                <img
                                                    src={profile.imageUrl}
                                                    alt={profile.displayName}
                                                    className="h-8 w-8 rounded-full object-cover ring-2 ring-[var(--chat-accent)]"
                                                />
                                            ) : (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chat-accent)] text-[11px] font-medium text-[var(--chat-on-accent)]">
                                                    {profile.displayName.slice(0, 1)}
                                                </div>
                                            )
                                        ) : (
                                            <ChatAvatar
                                                size={32}
                                                name={profile.displayName}
                                                colors={orbColors}
                                                variant={animationConfig.variant}
                                                look={animationConfig.look}
                                                skin={animationConfig.skin}
                                                shape={animationConfig.shape}
                                                expression={animationConfig.expression}
                                                color={animationConfig.color}
                                                speed={animationConfig.speed}
                                                intensity={animationConfig.intensity}
                                                mood={orbMood}
                                                reactToken={orbReact}
                                                gaze={typingGaze}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-8 shrink-0" aria-hidden />
                                ))}
                                <div className="min-w-0 space-y-2">
                                    {!isUser && !typing && (
                                        <p className={cn(
                                            "px-1 text-[10px] font-medium uppercase tracking-wide",
                                            isOwner ? "text-[var(--chat-accent)]" : "text-profile-mute"
                                        )}>
                                            {isOwner ? profile.displayName : `${profile.displayName}'s AI`}
                                        </p>
                                    )}
                                    <div className={cn(
                                        "text-base leading-relaxed break-words",
                                        isUser
                                            ? "rounded-2xl rounded-br-sm px-4 py-2.5 text-[var(--chat-on-accent)] shadow-md"
                                            : typing
                                                ? "px-1 py-1"
                                                : isOwner
                                                    ? "rounded-2xl rounded-bl-sm px-4 py-2.5 text-profile-text shadow-md ring-1 ring-[var(--chat-accent)]/70"
                                                    : "rounded-2xl rounded-bl-sm border border-black/10 bg-black/[0.04] px-4 py-2.5 text-profile-text/90 dark:border-white/12 dark:bg-white/[0.04]"
                                    )}
                                    style={
                                        isUser
                                            ? { background: "var(--chat-accent)" }
                                            : isOwner && !typing
                                                ? { background: "color-mix(in oklab, var(--chat-accent) 22%, transparent)" }
                                                : undefined
                                    }
                                    >
                                        {m.content ? (
                                            isUser ? (
                                                <span className="whitespace-pre-wrap">{m.content}</span>
                                            ) : (
                                                <ChatMarkdown text={m.content} />
                                            )
                                        ) : (
                                            <span className="flex items-center gap-1 px-1">
                                                <span className="w-1.5 h-1.5 bg-profile-mute rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="w-1.5 h-1.5 bg-profile-mute rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="w-1.5 h-1.5 bg-profile-mute rounded-full animate-bounce"></span>
                                            </span>
                                        )}
                                    </div>

                                    {richContentType && onShowContent && m.content && (
                                        <button
                                            onClick={() => onShowContent(richContentType)}
                                            className="flex w-full max-w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-profile-elev p-3 text-left transition-all hover:border-brand/50 hover:bg-profile-chip group dark:border-white/10"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-profile-text text-sm">
                                                    {richContentType === 'experience' && `${profile.displayName}'s Work Experience`}
                                                    {richContentType === 'projects' && `${profile.displayName}'s Projects`}
                                                    {richContentType === 'about' && `About ${profile.displayName}`}
                                                    {richContentType === 'services' && `${profile.displayName}'s Services`}
                                                    {richContentType === 'products' && `${profile.displayName}'s Digital Products`}
                                                    {richContentType === 'courses' && `${profile.displayName}'s Courses`}
                                                    {richContentType === 'events' && `${profile.displayName}'s Events`}
                                                    {richContentType === 'communities' && `${profile.displayName}'s Communities`}
                                                </p>
                                                <p className="text-xs text-profile-mute mt-0.5">
                                                    {['products', 'courses', 'events', 'communities'].includes(richContentType)
                                                        ? 'View and purchase'
                                                        : richContentType === 'services'
                                                        ? 'View services and book'
                                                        : 'View details'}
                                                </p>
                                            </div>
                                            <div className="w-8 h-8 shrink-0 rounded-full bg-profile-chip flex items-center justify-center group-hover:bg-brand/20 group-hover:text-brand transition-colors">
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
                </div>
            </div>

            <div className={cn(
                "relative shrink-0 w-full bg-profile pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-opacity duration-500",
                !hasStarted && !introReady && "pointer-events-none opacity-0"
            )}>
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-profile to-transparent"
                />
                <div className="relative mx-auto w-full max-w-3xl px-3 sm:px-6 flex flex-col gap-2 sm:gap-3">
                    {chatMode === "LIVE_REQUESTED" && (
                        <div className="rounded-2xl border border-black/10 bg-profile-elev px-3 py-2 text-xs text-profile-mute dark:border-white/10">
                            Waiting for {profile.displayName}
                            {queuePosition > 1 ? ` · you’re #${queuePosition}` : ""}
                            {` · usually ~${slaMinutes} min`}
                            <button
                                type="button"
                                className="ml-2 underline"
                                onClick={async () => {
                                    if (!conversationId) return
                                    await fetch("/api/live", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ conversationId, action: "cancel" }),
                                    })
                                    setChatMode("AI")
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    {chatMode === "LIVE" && (
                        <div className="rounded-2xl border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-profile-text">
                            {profile.displayName} is here
                        </div>
                    )}
                    {hasStarted && !isLoading && chatMode === "AI" && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {isMember && liveChatEnabled && conversationId && (
                                <Chip
                                    variant="profile"
                                    size="sm"
                                    highlighted
                                    label={`Talk to ${profile.displayName}`}
                                    onClick={async () => {
                                        const res = await fetch("/api/live", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            credentials: "include",
                                            body: JSON.stringify({ conversationId, action: "request" }),
                                        })
                                        if (res.ok) {
                                            setChatMode("LIVE_REQUESTED")
                                            setLiveRequestedAt(new Date().toISOString())
                                        } else {
                                            toast.error("Could not start a live chat")
                                        }
                                    }}
                                />
                            )}
                            {suggestionPrompts.map((suggestion) => (
                                <Chip
                                    key={suggestion}
                                    variant="profile"
                                    size="sm"
                                    label={suggestion}
                                    onClick={() => playMouthThen(() => handleSubmit(undefined, suggestion))}
                                />
                            ))}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => handleSubmit(e)}
                        className="relative flex items-center group w-full"
                    >
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                            placeholder="Tell me more about..."
                            className="w-full h-12 sm:h-14 pl-4 sm:pl-6 pr-12 sm:pr-14 rounded-full bg-profile-elev border-black/10 text-profile-text placeholder:text-profile-mute shadow-2xl backdrop-blur-xl focus-visible:ring-1 focus-visible:ring-profile-ring focus-visible:border-brand/50 transition-all text-base dark:border-white/10"
                            disabled={isLoading}
                        />
                        <Button
                            size="icon"
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-1.5 sm:right-2 h-9 w-9 sm:h-10 sm:w-10 rounded-full shadow-lg transition-all disabled:opacity-50 touch-manipulation"
                            style={{ background: "var(--chat-accent)", color: "var(--chat-on-accent)" }}
                        >
                            <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeToReducedMotion(onStoreChange: () => void) {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}

    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    media.addEventListener("change", onStoreChange)
    return () => media.removeEventListener("change", onStoreChange)
}

function readReducedMotion() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(REDUCED_MOTION_QUERY).matches
        : false
}

function useReducedMotionPreference() {
    return useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, () => false)
}

function WelcomeIntro({
    name,
    welcome,
    topics,
    chips,
    onChip,
    orb,
    accent,
    bare,
    onReady,
    onStage,
}: {
    name: string
    welcome?: string | null
    topics?: string[]
    chips: ChatChip[]
    onChip: (chip: ChatChip) => void
    orb: ReactNode
    accent: string
    bare?: boolean
    onReady: () => void
    onStage?: (stage: "hi" | "type" | "orb" | "ready") => void
}) {
    const full = `I am ${name}'s AI.`
    const prefix = "I am "
    const [stage, setStage] = useState<"hi" | "type" | "orb" | "ready">("hi")
    const [typed, setTyped] = useState("")
    const [lineVisible, setLineVisible] = useState(false)
    const readyOnce = useRef(false)
    const reduce = useReducedMotionPreference()
    const visibleStage = reduce ? "ready" : stage
    const visibleTyped = reduce ? full : typed
    const visibleLine = reduce || lineVisible

    useEffect(() => {
        if (reduce) return
        // Fade in (~0.4s) + short hold, then exit. No empty beat after Hi.
        const leave = window.setTimeout(() => setStage("type"), 880)
        return () => window.clearTimeout(leave)
    }, [reduce])

    useEffect(() => {
        if (reduce || stage !== "type" || lineVisible) return
        const fallback = window.setTimeout(() => setLineVisible(true), 360)
        return () => window.clearTimeout(fallback)
    }, [reduce, stage, lineVisible])

    useEffect(() => {
        if (reduce || stage !== "type" || !lineVisible) return
        if (typed.length >= full.length) {
            const pause = window.setTimeout(() => setStage("orb"), 320)
            return () => window.clearTimeout(pause)
        }
        const next = full[typed.length] ?? ""
        const inPrefix = typed.length < prefix.length
        const atWordBreak = next === " " || next === "'"
        const speed = typed.length === 0 ? 160 : inPrefix ? 110 : atWordBreak ? 70 : 42
        const tick = window.setTimeout(() => setTyped(full.slice(0, typed.length + 1)), speed)
        return () => window.clearTimeout(tick)
    }, [reduce, stage, lineVisible, typed, full, prefix.length])

    useEffect(() => {
        if (reduce || stage !== "orb") return
        const t = window.setTimeout(() => setStage("ready"), 1480)
        return () => window.clearTimeout(t)
    }, [reduce, stage])

    useEffect(() => {
        onStage?.(visibleStage)
    }, [visibleStage, onStage])

    useEffect(() => {
        if (visibleStage !== "ready" || readyOnce.current) return
        readyOnce.current = true
        onReady()
    }, [visibleStage, onReady])

    const showCaret =
        !reduce &&
        ((visibleStage === "type" && visibleTyped.length < full.length) ||
            (visibleStage === "type" && !visibleLine))
    const typedPrefix = visibleTyped.slice(0, Math.min(visibleTyped.length, prefix.length))
    const typedRest = visibleTyped.slice(prefix.length)

    return (
        <div className="relative flex h-full flex-col items-center justify-center gap-7 px-3 py-4">
            <AnimatePresence>
                {(visibleStage === "orb" || visibleStage === "ready") && (
                    <motion.div
                        key="orb-slot"
                        className="relative z-[1] flex h-[180px] w-[180px] items-center justify-center overflow-visible"
                        initial={{ opacity: 0, height: 0, marginBottom: -36 }}
                        animate={{ opacity: 1, height: 180, marginBottom: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {!bare && (
                            <>
                                <motion.div
                                    className="pointer-events-none absolute inset-0 rounded-full"
                                    initial={{ opacity: 0.7, scale: 0.12 }}
                                    animate={{ opacity: 0, scale: 2.2 }}
                                    transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ boxShadow: `0 0 0 1.5px ${accent}` }}
                                />
                                <motion.div
                                    className="pointer-events-none absolute inset-0 rounded-full"
                                    initial={{ opacity: 0.45, scale: 0.12 }}
                                    animate={{ opacity: 0, scale: 2.55 }}
                                    transition={{ duration: 1.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ boxShadow: `0 0 0 1px ${accent}` }}
                                />
                                <motion.div
                                    className="pointer-events-none absolute inset-[-55%] rounded-full"
                                    initial={{ opacity: 0, scale: 0.12 }}
                                    animate={{ opacity: [0, 1, 0.58], scale: [0.12, 1.18, 1] }}
                                    transition={{ duration: 1.45, times: [0, 0.38, 1], ease: [0.16, 1, 0.3, 1] }}
                                    style={{
                                        background: `radial-gradient(circle, ${accent}cc 0%, ${accent}55 28%, transparent 68%)`,
                                        filter: "blur(22px)",
                                    }}
                                />
                            </>
                        )}
                        <motion.div
                            initial={{ opacity: 0, scale: bare ? 0.7 : 0.08, filter: bare ? "blur(0px)" : "blur(28px) brightness(2.6)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px) brightness(1)" }}
                            transition={{ duration: bare ? 0.55 : 1.2, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                        >
                            {orb}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-[1] flex min-h-[5rem] items-center justify-center text-center">
                <AnimatePresence
                    mode="wait"
                    onExitComplete={() => {
                        if (!reduce && stage === "type") setLineVisible(true)
                    }}
                >
                    {visibleStage === "hi" && (
                        <motion.h1
                            key="hi"
                            initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            className="text-display-sm sm:text-display font-medium tracking-tight text-profile-text"
                        >
                            Hi!
                        </motion.h1>
                    )}
                    {(visibleStage === "type" || visibleStage === "orb" || visibleStage === "ready") && (
                        <motion.div
                            key="line"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.12, ease: "easeOut" }}
                            className="max-w-xl"
                        >
                            <h1 className="text-title sm:text-display-sm font-medium tracking-tight text-profile-text">
                                <span>{typedPrefix}</span>
                                <span>{typedRest}</span>
                                {showCaret && (
                                    <motion.span
                                        aria-hidden
                                        className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.08em] bg-current align-baseline"
                                        animate={{ opacity: [1, 0.15, 1] }}
                                        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                                    />
                                )}
                            </h1>
                            {visibleStage === "ready" ? (
                                <AskAboutLine welcome={welcome} topics={topics} />
                            ) : null}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="relative z-[1] flex min-h-[2.75rem] flex-wrap justify-center gap-2 max-w-xl">
                {visibleStage === "ready" && chips.map((chip, i) => (
                    <motion.div
                        key={chip.id}
                        initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ delay: 0.05 + i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Chip
                            variant="profile"
                            highlighted={chip.highlighted}
                            icon={chip.icon}
                            label={chip.label}
                            onClick={() => onChip(chip)}
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

function AskAboutLine({ welcome, topics = [] }: { welcome?: string | null; topics?: string[] }) {
    // NO useMemo, deliberately. resolveAskTopics maps and filters at most five short strings, so
    // recomputing it per render costs less than caching it correctly - and the previous cache was
    // NOT correct. Its key was `topics.join("|")`, which is not injective: ["a|b"] and ["a","b"]
    // both join to "a|b", while resolveAskTopics treats them differently (it cleans each entry
    // without splitting on "|"). So when the parent re-rendered with one shape after the other the
    // memo handed back the previous, wrong topic list and kept handing it back forever.
    const items = resolveAskTopics(welcome, topics)
    const count = items.length

    // The typewriter is driven by PRIMITIVES (`current`, `count`) and never by the array's identity.
    // That is what makes the memo unnecessary rather than merely replaced: a parent passing a fresh
    // `topics` array literal on every render still yields an equal current/count pair, so the
    // animation is not restarted. Putting `topics` itself in a dependency array - the other obvious
    // repair - is exactly what would restart it.
    const [phase, setPhase] = useState({ index: 0, len: 0, deleting: false })
    const index = phase.index < count ? phase.index : 0
    const current = items[index] ?? ""

    // matchMedia is an external store, so it is subscribed to rather than copied into state by a
    // mount effect. The old version read `.matches` once with an empty dependency array and never
    // subscribed, so turning Reduce Motion ON while the page was open did nothing at all: the
    // animation kept running for a user who had just asked it to stop.
    const reduce = useReducedMotionPreference()

    useEffect(() => {
        if (reduce || count === 0) return
        if (!phase.deleting && phase.len >= current.length) {
            if (count < 2) return
            const hold = window.setTimeout(() => setPhase((p) => ({ ...p, deleting: true })), 1600)
            return () => window.clearTimeout(hold)
        }
        const speed = phase.deleting ? 26 : phase.len === 0 ? 70 : 38
        const tick = window.setTimeout(() => {
            // The whole transition happens in the timer callback, including the instant
            // "finished deleting, move to the next topic" step that the previous version performed
            // synchronously in the effect body. Nothing here calls setState during the effect.
            setPhase((p) => {
                if (!p.deleting) return { ...p, len: p.len + 1 }
                if (p.len <= 1) return { index: (p.index + 1) % count, len: 0, deleting: false }
                return { ...p, len: p.len - 1 }
            })
        }, speed)
        return () => window.clearTimeout(tick)
    }, [reduce, count, current, phase])

    if (!count) return null

    // Derived, not state. Under Reduce Motion the topic is simply shown whole; there is no
    // "set it once from an effect" step, so there is no frame in which it is missing.
    const typed = reduce ? current : current.slice(0, Math.min(phase.len, current.length))

    return (
        <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-1 text-ui text-profile-mute font-light whitespace-nowrap"
        >
            <span>Ask me about </span>
            <span className="text-profile-text">{typed}</span>
            {!reduce && count > 0 ? (
                <motion.span
                    aria-hidden
                    className="ml-0.5 inline-block h-[0.85em] w-[1.5px] translate-y-[0.1em] bg-current align-baseline"
                    animate={{ opacity: [1, 0.15, 1] }}
                    transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
                />
            ) : null}
        </motion.p>
    )
}

function resolveAskTopics(welcome?: string | null, topics: string[] = []) {
    const fromCatalog = topics.map(cleanTopic).filter(Boolean)
    const fromWelcome = parseWelcomeTopics(welcome)
    const seen = new Set<string>()
    const out: string[] = []
    for (const t of [...fromCatalog, ...fromWelcome]) {
        const key = t.toLowerCase()
        if (seen.has(key) || t.length < 2) continue
        seen.add(key)
        out.push(t)
        if (out.length >= 5) break
    }
    return out
}

function parseWelcomeTopics(raw?: string | null) {
    if (!raw) return []
    const stripped = raw.replace(/^ask(?:\s+me)?\s+about\s+/i, "").replace(/[.!?]+$/, "")
    return stripped
        .split(/\s*(?:,|;|\||\/| or )\s*/i)
        .map(cleanTopic)
        .filter((t) => t.length > 2)
}

function cleanTopic(raw: string) {
    return raw.replace(/\s+/g, " ").replace(/^[-–•]\s*/, "").replace(/[.!?]+$/, "").trim().slice(0, 36)
}

function contextualSuggestions(name: string, topic: RichContentType | null): string[] {
    switch (topic) {
        case "experience":
            return [
                `What else is in ${name}'s work history?`,
                `What are ${name}'s main achievements?`,
                "Dive into another topic",
            ]
        case "projects":
            return [
                "Walk me through a project",
                "What else is in the portfolio?",
                "Dive into another topic",
            ]
        case "about":
            return [
                `What should I know about ${name}?`,
                `How did ${name} get started?`,
                "Dive into another topic",
            ]
        case "products":
            return [
                `What other products does ${name} offer?`,
                "Tell me more about pricing",
                "Dive into another topic",
            ]
        case "courses":
            return [
                `What courses does ${name} offer?`,
                "Who are the courses for?",
                "Dive into another topic",
            ]
        case "events":
            return [
                "Are there other upcoming events?",
                "How do I register?",
                "Dive into another topic",
            ]
        case "communities":
            return [
                `Tell me about ${name}'s community`,
                "How do I join?",
                "Dive into another topic",
            ]
        default:
            return [
                `What should I know about ${name}?`,
                `How did ${name} get started?`,
                "Dive into another topic",
            ]
    }
}
