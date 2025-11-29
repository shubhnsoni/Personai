"use client"

import { Conversation, Message } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ConversationsListProps {
    conversations: (Conversation & { messages: Message[] })[]
}

export function ConversationsList({ conversations }: ConversationsListProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const selectedConversation = conversations.find(c => c.id === selectedId)

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
            <Card className="col-span-1 flex flex-col">
                <CardHeader className="pb-3">
                    <CardTitle>History</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <div className="h-full overflow-auto">
                        <div className="flex flex-col gap-1 p-2">
                            {conversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    className={cn(
                                        "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
                                        selectedId === conv.id && "bg-accent"
                                    )}
                                    onClick={() => setSelectedId(conv.id)}
                                >
                                    <div className="flex w-full flex-col gap-1">
                                        <div className="flex items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="font-semibold">{conv.visitorName || "Anonymous"}</div>
                                            </div>
                                            <div className="ml-auto text-xs text-muted-foreground">
                                                {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(conv.lastMessageAt))}
                                            </div>
                                        </div>
                                        <div className="line-clamp-2 text-xs text-muted-foreground">
                                            {conv.messages[conv.messages.length - 1]?.text || "No messages"}
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {conversations.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No conversations yet.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="col-span-1 md:col-span-2 flex flex-col">
                <CardHeader className="pb-3 border-b">
                    <CardTitle>
                        {selectedConversation ? (selectedConversation.visitorName || "Anonymous") : "Select a conversation"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    {selectedConversation ? (
                        <div className="h-full overflow-auto p-4">
                            <div className="flex flex-col gap-4">
                                {selectedConversation.messages.map((m: Message) => (
                                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-foreground'
                                            }`}>
                                            {m.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            Select a conversation to view messages
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
