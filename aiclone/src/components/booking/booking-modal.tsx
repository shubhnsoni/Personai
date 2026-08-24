"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, Clock, ArrowLeft, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { createBooking, getAvailableSlots } from "@/app/actions/bookings"
import { useMoney } from "@/components/pricing-provider"
import { CalendarLinks } from "@/components/calendar/calendar-links"

interface ServiceOffering {
    id: string
    name: string
    description: string | null
    priceCents: number
    isFree: boolean
    durationMinutes: number
    isActive: boolean
    kind?: string | null
    covers?: number | null
}

interface BookingModalProps {
    isOpen: boolean
    onClose: () => void
    profile: {
        id: string
        displayName: string
        serviceOfferings: ServiceOffering[]
    }
    selectedServiceId?: string | null
}

export function BookingModal({ isOpen, onClose, profile, selectedServiceId }: BookingModalProps) {
    const services = profile.serviceOfferings.filter(s => s.isActive)
    const [step, setStep] = useState(1)
    const [currentServiceId, setCurrentServiceId] = useState<string>(selectedServiceId || services[0]?.id || "")
    const [date, setDate] = useState("")
    const [slots, setSlots] = useState<string[]>([])
    const [selectedTime, setSelectedTime] = useState("")
    const [isLoadingSlots, setIsLoadingSlots] = useState(false)
    const [visitorName, setVisitorName] = useState("")
    const [visitorEmail, setVisitorEmail] = useState("")
    const [visitorPhone, setVisitorPhone] = useState("")
    const [partySize, setPartySize] = useState(2)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [booked, setBooked] = useState<{ id: string; start: Date; end: Date; title: string } | null>(null)
    const money = useMoney()

    useEffect(() => {
        if (selectedServiceId) {
            setCurrentServiceId(selectedServiceId)
        }
    }, [selectedServiceId])

    useEffect(() => {
        const service = services.find((s) => s.id === currentServiceId)
        if (date && currentServiceId) {
            setIsLoadingSlots(true)
            getAvailableSlots(profile.id, date, service?.durationMinutes || 30, {
                partySize: service?.kind === "TABLE" ? partySize : 1,
                serviceId: currentServiceId,
            })
                .then(setSlots)
                .catch(() => setSlots([]))
                .finally(() => setIsLoadingSlots(false))
        }
    }, [date, currentServiceId, profile.id, services, partySize])

    const handleSubmit = async () => {
        if (!currentServiceId || !date || !selectedTime) return
        setIsSubmitting(true)
        try {
            const service = services.find((s) => s.id === currentServiceId)
            const created = await createBooking({
                profileId: profile.id,
                serviceOfferingId: currentServiceId,
                startTime: `${date}T${selectedTime}:00`,
                visitorName,
                visitorEmail,
                partySize: service?.kind === "TABLE" ? partySize : undefined,
                visitorPhone: visitorPhone || undefined,
            })
            setBooked({
                id: created.id,
                start: new Date(created.startTime),
                end: new Date(created.endTime),
                title: service?.kind === "TABLE"
                    ? `Table for ${partySize} at ${profile.displayName}`
                    : `${service?.name || "Session"} with ${profile.displayName}`,
            })
            setIsSuccess(true)
            toast.success("Booking confirmed!", {
                description: `${profile.displayName} will see this on the calendar.`,
            })
        } catch (error) {
            console.error(error)
            toast.error("Booking failed", {
                description: "Please try again or contact support.",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const reset = () => {
        setStep(1)
        setIsSuccess(false)
        setBooked(null)
        setDate("")
        setSelectedTime("")
        setVisitorName("")
        setVisitorEmail("")
        setVisitorPhone("")
        setPartySize(2)
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const selectedService = services.find(s => s.id === currentServiceId)

    const isTable = selectedService?.kind === "TABLE"
    const minDate = new Date()
    if (!isTable) minDate.setDate(minDate.getDate() + 1)
    const minDateStr = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, "0")}-${String(minDate.getDate()).padStart(2, "0")}`

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
            <DialogContent className="flex max-h-[min(88dvh,100%)] flex-col overflow-hidden border-white/10 bg-zinc-950 p-0 text-white sm:max-w-[440px]">
                <AnimatePresence mode="wait">
                    {isSuccess ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center py-12 px-3 sm:px-6 space-y-4"
                        >
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-500" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-semibold">Booking Confirmed!</h3>
                                <p className="text-zinc-400">
                                    {booked?.title.includes("Table")
                                        ? `Your table at ${profile.displayName} is booked.`
                                        : `Your session with ${profile.displayName} is booked.`}
                                </p>
                            </div>
                            {booked && (
                                <div className="w-full">
                                    <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-zinc-500">Add to calendar</p>
                                    <CalendarLinks
                                        event={{
                                            id: booked.id,
                                            title: booked.title,
                                            start: booked.start,
                                            end: booked.end,
                                        }}
                                        icsHref={`/api/calendar/event/${booked.id}`}
                                    />
                                </div>
                            )}
                            <Button onClick={handleClose} className="mt-2">Done</Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`step-${step}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex min-h-0 flex-1 flex-col"
                        >
                            <DialogHeader className="shrink-0 space-y-3 border-b border-white/8 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {step > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setStep(step - 1)}
                                            className="h-8 w-8 rounded-full text-white hover:bg-white/10"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <DialogTitle className="text-sm font-medium">
                                        {step === 1 && (services.some((s) => s.kind === "TABLE") ? "Reserve" : "Choose a service")}
                                        {step === 2 && "Date and time"}
                                        {step === 3 && "Your details"}
                                    </DialogTitle>
                                </div>
                                <div className="flex gap-1">
                                    {[1, 2, 3].map((s) => (
                                        <div
                                            key={s}
                                            className={cn(
                                                "h-1 flex-1 rounded-full",
                                                s <= step ? "bg-cyan-500" : "bg-zinc-800"
                                            )}
                                        />
                                    ))}
                                </div>
                            </DialogHeader>

                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                                {step === 1 && (
                                    <div className="space-y-3">
                                        {services.length === 0 ? (
                                            <p className="text-center text-zinc-500 py-8">No services available for booking.</p>
                                        ) : (
                                            services.map(service => (
                                                <button
                                                    key={service.id}
                                                    onClick={() => setCurrentServiceId(service.id)}
                                                    className={cn(
                                                        "w-full text-left rounded-xl border p-4 transition-all",
                                                        currentServiceId === service.id 
                                                            ? "border-cyan-500 bg-cyan-500/10" 
                                                            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                                                    )}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <div className="font-medium">{service.name}</div>
                                                            {service.description && (
                                                                <p className="text-sm text-zinc-500 line-clamp-2">{service.description}</p>
                                                            )}
                                                        </div>
                                                        <div className="text-right shrink-0 ml-4">
                                                            <div className="font-semibold text-lg">
                                                                {money(service.priceCents)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {service.durationMinutes} min
                                                        </span>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                        {services.find((s) => s.id === currentServiceId)?.kind === "TABLE" ? (
                                            <div className="space-y-2">
                                                <Label className="text-zinc-400">Party size</Label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                                        <button
                                                            key={n}
                                                            type="button"
                                                            onClick={() => setPartySize(n)}
                                                            className={cn(
                                                                "h-9 w-9 rounded-full text-sm",
                                                                partySize === n ? "bg-cyan-500 text-zinc-950" : "bg-zinc-800 text-zinc-300",
                                                            )}
                                                        >
                                                            {n}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        <Button
                                            className="h-10 w-full rounded-full"
                                            onClick={() => setStep(2)}
                                            disabled={!currentServiceId || services.length === 0}
                                        >
                                            Continue
                                        </Button>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-4">
                                        {selectedService && (
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                                                <div className="flex items-center gap-3">
                                                    <Calendar className="w-5 h-5 text-cyan-400" />
                                                    <span className="font-medium">{selectedService.name}</span>
                                                </div>
                                                <span className="text-sm text-zinc-400">{selectedService.durationMinutes} min</span>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400">Select Date</Label>
                                            <Input
                                                type="date"
                                                min={minDateStr}
                                                value={date}
                                                onChange={(e) => {
                                                    setDate(e.target.value)
                                                    setSelectedTime("")
                                                }}
                                                className="bg-zinc-900 border-zinc-800"
                                            />
                                        </div>
                                        {date && (
                                            <div className="space-y-2">
                                                <Label className="text-zinc-400">Available Times</Label>
                                                {isLoadingSlots ? (
                                                    <div className="flex justify-center py-8">
                                                        <Loader2 className="animate-spin text-cyan-400" />
                                                    </div>
                                                ) : slots.length > 0 ? (
                                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                                                        {slots.map(slot => (
                                                            <Button
                                                                key={slot}
                                                                variant={selectedTime === slot ? "default" : "outline"}
                                                                size="sm"
                                                                onClick={() => setSelectedTime(slot)}
                                                                className={cn(
                                                                    "text-xs",
                                                                    selectedTime === slot 
                                                                        ? "bg-cyan-600 hover:bg-cyan-500 border-cyan-500 text-zinc-950" 
                                                                        : "border-zinc-700 hover:bg-zinc-800"
                                                                )}
                                                            >
                                                                {slot}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-zinc-500 text-center py-4">No available slots for this date</p>
                                                )}
                                            </div>
                                        )}
                                        <Button
                                            className="h-10 w-full rounded-full"
                                            onClick={() => setStep(3)}
                                            disabled={!date || !selectedTime}
                                        >
                                            Continue
                                        </Button>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-4">
                                        {selectedService && (
                                            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-400">{selectedService.kind === "TABLE" ? "Table" : "Service"}</span>
                                                    <span className="font-medium">
                                                        {selectedService.kind === "TABLE" ? `Table for ${partySize}` : selectedService.name}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-400">Date & Time</span>
                                                    <span className="font-medium">{date} at {selectedTime}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-400">Duration</span>
                                                    <span className="font-medium">{selectedService.durationMinutes} min</span>
                                                </div>
                                                <div className="flex justify-between border-t border-zinc-800 pt-2 mt-2">
                                                    <span className="text-zinc-400">Total</span>
                                                    <span className="font-semibold text-lg">
                                                        {money(selectedService.priceCents)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400">Your Name</Label>
                                            <Input 
                                                value={visitorName} 
                                                onChange={(e) => setVisitorName(e.target.value)} 
                                                placeholder="John Doe"
                                                className="bg-zinc-900 border-zinc-800" 
                                            />
                                        </div>
                                        {selectedService?.kind === "TABLE" ? (
                                            <div className="space-y-2">
                                                <Label className="text-zinc-400">Phone</Label>
                                                <Input
                                                    value={visitorPhone}
                                                    onChange={(e) => setVisitorPhone(e.target.value)}
                                                    placeholder="98…"
                                                    className="bg-zinc-900 border-zinc-800"
                                                />
                                            </div>
                                        ) : null}
                                        <div className="space-y-2">
                                            <Label className="text-zinc-400">Your Email</Label>
                                            <Input 
                                                type="email"
                                                value={visitorEmail} 
                                                onChange={(e) => setVisitorEmail(e.target.value)} 
                                                placeholder="john@example.com"
                                                className="bg-zinc-900 border-zinc-800" 
                                            />
                                        </div>
                                        <Button
                                            className="h-10 w-full rounded-full bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                                            onClick={handleSubmit}
                                            disabled={isSubmitting || !visitorName || (isTable ? !visitorPhone : !visitorEmail)}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                                    Confirming...
                                                </>
                                            ) : (
                                                isTable ? "Hold table" : selectedService?.isFree ? "Confirm Booking" : "Continue to Payment"
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    )
}
