"use client"
import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import { ArrowUp, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { fadeUp, scaleIn } from "@/lib/motion"
import { WelcomeOrb } from "@/components/welcome-orb"
import { toast } from "sonner"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
}

export type ChatChip = {
    id: string
    label: string
    highlighted?: boolean
    icon?: ReactNode
    /** Send this as a visitor message. Ignored when onSelect is set. */
    prompt?: string
    onSelect?: () => void
}

interface ChatInterfaceProps {
    profile: {
        id: string
        displayName: string
        welcomeMessageOverride?: string | null
        slug: string
    }
    welcome?: ReactNode
    chips?: ChatChip[]
    quickQuestions?: string[]
    onShowContent?: (type: "about" | "experience" | "projects" | "products" | "courses" | "events" | "communities") => void
    colors?: string[]
    animationConfig?: { speed?: number; intensity?: number }
    isPanelOpen?: boolean
}

type RichContentType = "experience" | "projects" | "about" | "products" | "courses" | "events" | "communities"

export function ChatInterface({
    profile,
    chips = [],
    quickQuestions = [],
    onShowContent,
    colors = [],
    animationConfig = {},
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [visitorId, setVisitorId] = useState<string | null>(null)
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const orbColors = colors.length >= 2 ? (colors as [string, string]) : undefined

    // Initialize visitor ID and load conversation history
    useEffect(() => {
        const stored = localStorage.getItem(`personalink_visitor_${profile.id}`)
        let vid = stored
        if (!vid) {
            vid = `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
            localStorage.setItem(`personalink_visitor_${profile.id}`, vid)
        }
        setVisitorId(vid)

        // Load previous conversation
        fetch(`/api/conversations?profileId=${profile.id}&visitorId=${vid}`)
            .then(res => res.json())
            .then(data => {
                if (data.messages && data.messages.length > 0) {
                    setMessages(data.messages)
                    setConversationId(data.conversationId)
                }
            })
            .catch(() => {})
            .finally(() => setIsLoadingHistory(false))
    }, [profile.id])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isLoading])

    const getRichContent = (content: string): RichContentType | null => {
        const lower = content.toLowerCase()
        if (lower.includes("experience") || lower.includes("work history")) return "experience"
        if (lower.includes("project") || lower.includes("portfolio")) return "projects"
        if (lower.includes("about") || lower.includes("who is")) return "about"
        if (lower.includes("digital products") || lower.includes("would you like to purchase")) return "products"
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
            content: ""
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
    }, [messages, profile.id, conversationId, visitorId, isLoading])

    const handleSubmit = (e?: React.FormEvent, overrideInput?: string) => {
        e?.preventDefault()
        const messageToSend = overrideInput || input
        sendMessage(messageToSend)
    }

    const handleChip = (chip: ChatChip) => {
        if (chip.onSelect) {
            chip.onSelect()
            return
        }
        if (chip.prompt) {
            sendMessage(chip.prompt)
            return
        }
        inputRef.current?.focus()
    }

    const hasStarted = messages.length > 0 || isLoadingHistory
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant" && m.content)
    const suggestionPrompts = hasStarted
        ? contextualSuggestions(profile.displayName, lastAssistant ? getRichContent(lastAssistant.content) : null)
        : []
    const primaryChip = chips.find(c => c.highlighted) ?? chips[0]
    const emptyChips = chips.length > 0
        ? chips
        : quickQuestions.map((q, i) => ({ id: `q-${i}`, label: q, prompt: q }))

    return (
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative text-profile-text">
            {hasStarted && (
                <div className="shrink-0 z-20 px-4 py-3 flex items-center gap-3 border-b border-white/5">
                    <div className="relative w-8 h-8">
                        <WelcomeOrb
                            size={32}
                            colors={orbColors}
                            speed={animationConfig.speed || 1}
                            intensity={animationConfig.intensity || 1}
                        />
                    </div>
                    <span className="font-semibold text-ui text-profile-text">
                        {profile.displayName}&apos;s AI
                    </span>
                    {primaryChip && (
                        <Chip
                            className="ml-auto"
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
                className={cn(
                    "flex-1 min-h-0 overflow-y-auto scroll-smooth",
                    hasStarted ? "p-4 space-y-8" : ""
                )}
            >
                {!hasStarted && (
                    <motion.div
                        className="flex h-full flex-col items-center justify-center gap-8 px-4 py-6"
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div variants={scaleIn}>
                            <WelcomeOrb
                                size={140}
                                colors={orbColors}
                                speed={animationConfig.speed || 1}
                                intensity={animationConfig.intensity || 1}
                            />
                        </motion.div>

                        <motion.div variants={fadeUp} custom={1} className="text-center space-y-3 max-w-xl">
                            <h1 className="text-title sm:text-display-sm font-medium tracking-tight text-profile-text">
                                I am {profile.displayName}&apos;s AI.
                            </h1>
                            {profile.welcomeMessageOverride ? (
                                <p className="text-body text-profile-mute font-light">
                                    {profile.welcomeMessageOverride}
                                </p>
                            ) : null}
                        </motion.div>

                        {emptyChips.length > 0 && (
                            <motion.div
                                variants={fadeUp}
                                custom={2}
                                className="flex flex-wrap justify-center gap-2 max-w-xl"
                            >
                                {emptyChips.map((chip) => (
                                    <Chip
                                        key={chip.id}
                                        variant="profile"
                                        highlighted={chip.highlighted}
                                        icon={chip.icon}
                                        label={chip.label}
                                        onClick={() => handleChip(chip)}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {messages.map((m) => {
                    const richContentType = m.role !== 'user' ? getRichContent(m.content) : null
                    const isUser = m.role === 'user'

                    return (
                        <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 gap-2`}>
                            <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} max-w-[90%]`}>
                                {!isUser && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orb-from to-orb-to flex items-center justify-center mr-3 shrink-0 shadow-lg mt-1">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div className={cn(
                                    "px-5 py-3 text-base leading-relaxed",
                                    isUser
                                        ? "bg-profile-elev text-profile-text rounded-2xl rounded-br-sm shadow-md"
                                        : "text-profile-text/90"
                                )}>
                                    {m.content || (
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-profile-mute rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-profile-mute rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-profile-mute rounded-full animate-bounce"></span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {richContentType && onShowContent && m.content && (
                                <div className="ml-11 w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300">
                                    <button
                                        onClick={() => onShowContent(richContentType)}
                                        className="w-full flex items-center justify-between p-4 rounded-xl bg-profile-elev border border-white/10 hover:border-brand/50 hover:bg-profile-chip transition-all group text-left"
                                    >
                                        <div>
                                            <p className="font-medium text-profile-text text-sm">
                                                {richContentType === 'experience' && `${profile.displayName}'s Work Experience`}
                                                {richContentType === 'projects' && `${profile.displayName}'s Design Projects`}
                                                {richContentType === 'about' && `About ${profile.displayName}`}
                                                {richContentType === 'products' && `${profile.displayName}'s Digital Products`}
                                                {richContentType === 'courses' && `${profile.displayName}'s Courses`}
                                                {richContentType === 'events' && `${profile.displayName}'s Events`}
                                                {richContentType === 'communities' && `${profile.displayName}'s Communities`}
                                            </p>
                                            <p className="text-xs text-profile-mute mt-0.5">
                                                {['products', 'courses', 'events', 'communities'].includes(richContentType)
                                                    ? 'View and purchase'
                                                    : 'Click to view details'}
                                            </p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-profile-chip flex items-center justify-center group-hover:bg-brand/20 group-hover:text-brand transition-colors">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="shrink-0 px-2 sm:px-4 pt-3 pb-2 sm:pb-4 bg-gradient-to-t from-profile via-profile/90 to-transparent safe-bottom">
                <div className="max-w-3xl mx-auto relative w-full flex flex-col gap-2 sm:gap-3">
                    {hasStarted && !isLoading && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {suggestionPrompts.map((suggestion) => (
                                <Chip
                                    key={suggestion}
                                    variant="profile"
                                    size="sm"
                                    label={suggestion}
                                    onClick={() => handleSubmit(undefined, suggestion)}
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
                            placeholder="Tell me more about..."
                            className="w-full h-12 sm:h-14 pl-4 sm:pl-6 pr-12 sm:pr-14 rounded-full bg-profile-elev border-white/10 text-profile-text placeholder:text-profile-mute shadow-2xl backdrop-blur-xl focus-visible:ring-1 focus-visible:ring-profile-ring focus-visible:border-brand/50 transition-all text-sm sm:text-base"
                            disabled={isLoading}
                        />
                        <Button
                            size="icon"
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-1.5 sm:right-2 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-profile-chip hover:bg-profile-text hover:text-profile-bg text-profile-text shadow-lg transition-all disabled:opacity-50 disabled:hover:bg-profile-chip disabled:hover:text-profile-text touch-manipulation"
                        >
                            <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
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
