"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Block =
    | { type: "p"; text: string }
    | { type: "h"; text: string }
    | { type: "ul"; items: string[] }
    | { type: "ol"; items: string[] }

function splitBlocks(raw: string): Block[] {
    const lines = raw.replace(/\r\n/g, "\n").split("\n")
    const blocks: Block[] = []
    let para: string[] = []
    let list: { type: "ul" | "ol"; items: string[] } | null = null

    const flushPara = () => {
        if (!para.length) return
        blocks.push({ type: "p", text: para.join("\n") })
        para = []
    }
    const flushList = () => {
        if (!list) return
        blocks.push(list)
        list = null
    }

    for (const line of lines) {
        const heading = line.match(/^#{1,3}\s+(.+)$/)
        const ul = line.match(/^\s*[-*]\s+(.+)$/)
        const ol = line.match(/^\s*\d+[.)]\s+(.+)$/)

        if (heading) {
            flushPara()
            flushList()
            blocks.push({ type: "h", text: heading[1] })
        } else if (ul) {
            flushPara()
            if (!list || list.type !== "ul") {
                flushList()
                list = { type: "ul", items: [] }
            }
            list.items.push(ul[1])
        } else if (ol) {
            flushPara()
            if (!list || list.type !== "ol") {
                flushList()
                list = { type: "ol", items: [] }
            }
            list.items.push(ol[1])
        } else if (line.trim() === "") {
            flushPara()
            flushList()
        } else {
            flushList()
            para.push(line)
        }
    }
    flushPara()
    flushList()
    return blocks
}

function inline(text: string): ReactNode[] {
    const nodes: ReactNode[] = []
    const re = /(\*\*[^*]+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+?\*)/g
    let last = 0
    let match: RegExpExecArray | null
    let key = 0

    while ((match = re.exec(text)) !== null) {
        if (match.index > last) {
            nodes.push(text.slice(last, match.index))
        }
        const token = match[0]
        if (token.startsWith("**")) {
            nodes.push(<strong key={key++} className="font-semibold">{token.slice(2, -2)}</strong>)
        } else if (token.startsWith("`")) {
            nodes.push(
                <code key={key++} className="rounded bg-black/20 px-1 py-0.5 text-[0.85em]">
                    {token.slice(1, -1)}
                </code>
            )
        } else if (token.startsWith("[")) {
            const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
            if (link) {
                const href = link[2]
                const safe = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("/")
                nodes.push(
                    <a
                        key={key++}
                        href={safe ? href : undefined}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="underline underline-offset-2"
                    >
                        {link[1]}
                    </a>
                )
            } else {
                nodes.push(token)
            }
        } else {
            nodes.push(<em key={key++}>{token.slice(1, -1)}</em>)
        }
        last = match.index + token.length
    }
    if (last < text.length) nodes.push(text.slice(last))
    return nodes
}

function withBreaks(text: string): ReactNode[] {
    const parts = text.split("\n")
    const out: ReactNode[] = []
    parts.forEach((part, i) => {
        if (i > 0) out.push(<br key={`br-${i}`} />)
        out.push(...inline(part))
    })
    return out
}

export function ChatMarkdown({ text, className }: { text: string; className?: string }) {
    const blocks = splitBlocks(text.trim() ? text : "")
    if (blocks.length === 0) return null

    return (
        <div className={cn("min-w-0", className)}>
            {blocks.map((block, i) => {
                if (block.type === "h") {
                    return (
                        <p key={i} className={cn("font-semibold", i > 0 && "mt-2.5")}>
                            {inline(block.text)}
                        </p>
                    )
                }
                if (block.type === "ul" || block.type === "ol") {
                    const Tag = block.type
                    return (
                        <Tag
                            key={i}
                            className={cn(
                                "my-1.5 space-y-1 pl-4",
                                block.type === "ul" ? "list-disc" : "list-decimal",
                                i === 0 && "mt-0"
                            )}
                        >
                            {block.items.map((item, j) => (
                                <li key={j} className="pl-0.5 marker:text-current/55">
                                    {inline(item)}
                                </li>
                            ))}
                        </Tag>
                    )
                }
                return (
                    <p key={i} className={cn(i > 0 && "mt-2")}>
                        {withBreaks(block.text)}
                    </p>
                )
            })}
        </div>
    )
}
