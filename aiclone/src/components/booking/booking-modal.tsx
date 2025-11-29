"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ServiceOffering } from "@prisma/client"
import { getAvailableSlots, createBooking } from "@/app/actions/bookings"
import { Loader2, CheckCircle } from "lucide-react"

interface BookingModalProps {
    profile: any
    services: ServiceOffering[]
    trigger?: React.ReactNode
}

export function BookingModal({ profile, services, trigger }: BookingModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState(1)
    const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || "")
    const [date, setDate] = useState("")
    const [slots, setSlots] = useState<string[]>([])
    const [selectedTime, setSelectedTime] = useState("")
    const [isLoadingSlots, setIsLoadingSlots] = useState(false)
    const [visitorName, setVisitorName] = useState("")
    const [visitorEmail, setVisitorEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    useEffect(() => {
        if (date && selectedServiceId) {
            setIsLoadingSlots(true)
            getAvailableSlots(profile.id, date)
                .then(setSlots)
                .finally(() => setIsLoadingSlots(false))
        }
    }, [date, selectedServiceId, profile.id])

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            await createBooking({
                profileId: profile.id,
                serviceOfferingId: selectedServiceId,
                startTime: `${date}T${selectedTime}`,
                visitorName,
                visitorEmail
            })
            setIsSuccess(true)
        } catch (error) {
            console.error(error)
            alert("Failed to book")
        } finally {
            setIsSubmitting(false)
        }
    }

    const reset = () => {
        setStep(1)
        setIsSuccess(false)
        setDate("")
        setSelectedTime("")
        setVisitorName("")
        setVisitorEmail("")
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) reset(); }}>
            <DialogTrigger asChild>
                {trigger || <Button>Book a Call</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {isSuccess ? "Booking Confirmed" : "Book a Session"}
                    </DialogTitle>
                </DialogHeader>

                {isSuccess ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                        <p className="text-center text-muted-foreground">
                            Your session has been booked successfully.<br />
                            Check your email for details.
                        </p>
                        <Button onClick={() => setIsOpen(false)}>Close</Button>
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Select Service</Label>
                                    <div className="grid gap-2">
                                        {services.map(service => (
                                            <div
                                                key={service.id}
                                                className={`cursor-pointer rounded-lg border p-4 hover:bg-accent ${selectedServiceId === service.id ? 'border-primary bg-accent' : ''}`}
                                                onClick={() => setSelectedServiceId(service.id)}
                                            >
                                                <div className="flex justify-between font-medium">
                                                    <span>{service.name}</span>
                                                    <span>${(service.priceCents / 100).toFixed(0)}</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {service.durationMinutes} mins
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button className="w-full" onClick={() => setStep(2)} disabled={!selectedServiceId}>
                                    Next
                                </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Select Date</Label>
                                    <Input
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                                {date && (
                                    <div className="space-y-2">
                                        <Label>Select Time</Label>
                                        {isLoadingSlots ? (
                                            <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>
                                        ) : slots.length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                                                {slots.map(slot => (
                                                    <Button
                                                        key={slot}
                                                        variant={selectedTime === slot ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setSelectedTime(slot)}
                                                    >
                                                        {slot}
                                                    </Button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-2">No slots available</p>
                                        )}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <Button variant="outline" className="w-full" onClick={() => setStep(1)}>Back</Button>
                                    <Button className="w-full" onClick={() => setStep(3)} disabled={!date || !selectedTime}>Next</Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Your Name</Label>
                                    <Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Your Email</Label>
                                    <Input value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="john@example.com" />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="w-full" onClick={() => setStep(2)}>Back</Button>
                                    <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || !visitorName || !visitorEmail}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                                        Confirm Booking
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
