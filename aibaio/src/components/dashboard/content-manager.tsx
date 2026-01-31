"use client"

import { useState } from "react"
import { ProfileDocument } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, FileText, Link as LinkIcon, Plus } from "lucide-react"
import { addContent, deleteContent } from "@/app/actions/content"

interface ContentManagerProps {
    profileId: string
    documents: ProfileDocument[]
}

export function ContentManager({ profileId, documents }: ContentManagerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("text")
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAdd = async () => {
        if (!title || !content) return
        setIsSubmitting(true)
        try {
            await addContent(profileId, {
                type: activeTab === "text" ? "TEXT" : "URL",
                title,
                content
            })
            setIsOpen(false)
            setTitle("")
            setContent("")
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure?")) {
            await deleteContent(id)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Knowledge Base</h2>
                    <p className="text-muted-foreground">Teach your AI about you and your services.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add Content</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Knowledge</DialogTitle>
                            <DialogDescription>Add text or links for your AI to learn from.</DialogDescription>
                        </DialogHeader>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="text">Text</TabsTrigger>
                                <TabsTrigger value="url">URL</TabsTrigger>
                            </TabsList>
                            <TabsContent value="text" className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Title</Label>
                                    <Input placeholder="e.g. My Bio" value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Content</Label>
                                    <Textarea placeholder="Paste text here..." value={content} onChange={e => setContent(e.target.value)} />
                                </div>
                            </TabsContent>
                            <TabsContent value="url" className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Title</Label>
                                    <Input placeholder="e.g. My Portfolio" value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>URL</Label>
                                    <Input placeholder="https://..." value={content} onChange={e => setContent(e.target.value)} />
                                </div>
                            </TabsContent>
                        </Tabs>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleAdd} disabled={isSubmitting}>
                                {isSubmitting ? "Adding..." : "Add Content"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                    <Card key={doc.id}>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {doc.title}
                            </CardTitle>
                            {doc.sourceType === "URL" ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground mb-4 line-clamp-3">
                                {doc.sourceType === "URL" ? doc.url : doc.rawText}
                            </div>
                            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => handleDelete(doc.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </Button>
                        </CardContent>
                    </Card>
                ))}
                {documents.length === 0 && (
                    <div className="col-span-full text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                        No content added yet.
                    </div>
                )}
            </div>
        </div>
    )
}
