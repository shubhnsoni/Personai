"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowUp, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { WelcomeOrb } from "@/components/welcome-orb"
import { toast } from "sonner"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
}

interface ChatInterfaceProps {
    profile: {
        id: string
        displayName: string
        welcomeMessageOverride?: string | null
        slug: string
    }
    welcome?: React.ReactNode
    quickQuestions?: string[]
    onShowContent?: (type: "about" | "experience" | "projects" | "products" | "courses" | "events" | "communities") => void
    colors?: string[]
    animationConfig?: { speed?: number; intensity?: number }
    isPanelOpen?: boolean
}

export function ChatInterface({ 
    profile, 
    quickQuestions = [], 
    onShowContent, 
    colors = [], 
    animationConfig = {}, 
    isPanelOpen = false 
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [visitorId, setVisitorId] = useState<string | null>(null)
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const scrollRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

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

    const getRichContent = (content: string): "experience" | "projects" | "about" | "products" | "courses" | "events" | "communities" | null => {
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

    const hasStarted = messages.length > 0 || isLoadingHistory

    return (
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative">
            {hasStarted && (
                <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center gap-3 bg-black/20 backdrop-blur-sm border-b border-white/5 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="relative w-8 h-8">
                        <WelcomeOrb
                            size={32}
                            colors={colors && colors.length >= 2 ? (colors as [string, string]) : undefined}
                            speed={animationConfig.speed || 1}
                            intensity={animationConfig.intensity || 1}
                        />
                    </div>
                    <span className="font-semibold text-sm text-zinc-200">
                        {profile.displayName}&apos;s AI
                    </span>
                </div>
            )}

            <div ref={scrollRef} className={cn(
                "flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth pb-32 transition-all duration-500",
                hasStarted ? "pt-20" : ""
            )}>
                {!hasStarted && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in zoom-in duration-500">
                        <div className="flex flex-col items-center space-y-8 mt-12">
                            <div className="relative">
                                <WelcomeOrb
                                    size={200}
                                    colors={colors as [string, string]}
                                    speed={animationConfig.speed || 1}
                                    intensity={animationConfig.intensity || 1}
                                />
                            </div>

                            <div className="text-center space-y-3">
                                <h1 className="text-3xl md:text-4xl font-medium tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                                    I am {profile.displayName}&apos;s AI.
                                </h1>
                                <p className="text-xl text-zinc-400 font-light">
                                    {profile.welcomeMessageOverride || "Mind telling me who you are?"}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-xl px-2 sm:px-4">
                            {quickQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSubmit(undefined, q)}
                                    className="text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-[0.98] hover:scale-[1.02] text-xs sm:text-sm text-zinc-400 hover:text-zinc-100 shadow-sm group touch-manipulation"
                                >
                                    <span className="mr-1.5 sm:mr-2 group-hover:scale-110 inline-block transition-transform">💬</span> {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m) => {
                    const richContentType = m.role !== 'user' ? getRichContent(m.content) : null
                    const isUser = m.role === 'user'

                    return (
                        <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 gap-2`}>
                            <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} max-w-[90%]`}>
                                {!isUser && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-3 shrink-0 shadow-lg shadow-purple-500/20 mt-1">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div className={cn(
                                    "px-5 py-3 text-base leading-relaxed",
                                    isUser
                                        ? "bg-zinc-800 text-white rounded-2xl rounded-br-sm shadow-md"
                                        : "text-zinc-300"
                                )}>
                                    {m.content || (
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {richContentType && onShowContent && m.content && (
                                <div className="ml-11 w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300">
                                    <button
                                        onClick={() => onShowContent(richContentType)}
                                        className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-800/80 transition-all group text-left"
                                    >
                                        <div>
                                            <p className="font-medium text-white text-sm">
                                                {richContentType === 'experience' && `${profile.displayName}'s Work Experience`}
                                                {richContentType === 'projects' && `${profile.displayName}'s Design Projects`}
                                                {richContentType === 'about' && `About ${profile.displayName}`}
                                                {richContentType === 'products' && `${profile.displayName}'s Digital Products`}
                                                {richContentType === 'courses' && `${profile.displayName}'s Courses`}
                                                {richContentType === 'events' && `${profile.displayName}'s Events`}
                                                {richContentType === 'communities' && `${profile.displayName}'s Communities`}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-0.5">
                                                {['products', 'courses', 'events', 'communities'].includes(richContentType) 
                                                    ? 'View and purchase' 
                                                    : 'Click to view details'}
                                            </p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-t from-black via-black/80 to-transparent pt-16 safe-bottom">
                <div className="max-w-3xl mx-auto relative w-full flex flex-col gap-2 sm:gap-3">
                    {hasStarted && !isLoading && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {[
                                `How did ${profile.displayName} start his career?`,
                                `What are ${profile.displayName}'s main achievements?`,
                                "Dive into another topic"
                            ].map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSubmit(undefined, suggestion)}
                                    className="whitespace-nowrap px-4 py-2 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 transition-all shadow-sm backdrop-blur-sm"
                                >
                                    <span className="mr-1.5">💬</span> {suggestion}
                                </button>
                            ))}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => handleSubmit(e)}
                        className="relative flex items-center group w-full"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={`Tell me more about...`}
                            className="w-full h-12 sm:h-14 pl-4 sm:pl-6 pr-12 sm:pr-14 rounded-full bg-zinc-900/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 shadow-2xl backdrop-blur-xl focus-visible:ring-1 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 transition-all text-sm sm:text-base"
                            disabled={isLoading}
                        />
                        <Button
                            size="icon"
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-1.5 sm:right-2 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-zinc-800 hover:bg-white hover:text-black text-white shadow-lg transition-all disabled:opacity-50 disabled:hover:bg-zinc-800 disabled:hover:text-white touch-manipulation"
                        >
                            <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
