"use client"

import { useState } from "react"
import { ServiceOffering } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2, Plus, Clock, DollarSign } from "lucide-react"
import { addService, deleteService } from "@/app/actions/services"

interface ServicesManagerProps {
    profileId: string
    services: ServiceOffering[]
}

export function ServicesManager({ profileId, services }: ServicesManagerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [price, setPrice] = useState("")
    const [duration, setDuration] = useState("30")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAdd = async () => {
        if (!name || !price || !duration) return
        setIsSubmitting(true)
        try {
            await addService(profileId, {
                name,
                description,
                price: parseFloat(price),
                duration: parseInt(duration)
            })
            setIsOpen(false)
            setName("")
            setDescription("")
            setPrice("")
            setDuration("30")
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure?")) {
            await deleteService(id)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Services</h2>
                    <p className="text-muted-foreground">Manage your offerings and pricing.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add Service</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Service</DialogTitle>
                            <DialogDescription>Create a new service offering.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input placeholder="e.g. 1-on-1 Consultation" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea placeholder="What's included?" value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Price (USD)</Label>
                                    <Input type="number" placeholder="100" value={price} onChange={e => setPrice(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Duration (Minutes)</Label>
                                    <Input type="number" placeholder="30" value={duration} onChange={e => setDuration(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleAdd} disabled={isSubmitting}>
                                {isSubmitting ? "Adding..." : "Add Service"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                    <Card key={service.id}>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <CardTitle className="text-base font-medium">
                                {service.name}
                            </CardTitle>
                            <div className="font-bold text-lg">
                                ${(service.priceCents / 100).toFixed(0)}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground mb-4 h-10 line-clamp-2">
                                {service.description}
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground mb-4">
                                <Clock className="mr-1 h-3 w-3" /> {service.durationMinutes} mins
                            </div>
                            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => handleDelete(service.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </Button>
                        </CardContent>
                    </Card>
                ))}
                {services.length === 0 && (
                    <div className="col-span-full text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                        No services added yet.
                    </div>
                )}
            </div>
        </div>
    )
}
