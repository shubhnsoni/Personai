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

interface ServiceOffering {
    id: string
    name: string
    description: string | null
    priceCents: number
    isFree: boolean
    durationMinutes: number
    isActive: boolean
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
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    useEffect(() => {
        if (selectedServiceId) {
            setCurrentServiceId(selectedServiceId)
        }
    }, [selectedServiceId])

    useEffect(() => {
        if (date && currentServiceId) {
            setIsLoadingSlots(true)
            generateMockSlots()
                .then(setSlots)
                .finally(() => setIsLoadingSlots(false))
        }
    }, [date, currentServiceId])

    const generateMockSlots = async (): Promise<string[]> => {
        await new Promise(r => setTimeout(r, 500))
        const slots = []
        for (let h = 9; h <= 17; h++) {
            slots.push(`${h.toString().padStart(2, '0')}:00`)
            if (h < 17) slots.push(`${h.toString().padStart(2, '0')}:30`)
        }
        return slots.filter(() => Math.random() > 0.3)
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            await new Promise(r => setTimeout(r, 1500))
            setIsSuccess(true)
            toast.success("Booking confirmed!", {
                description: "Check your email for details.",
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
        setDate("")
        setSelectedTime("")
        setVisitorName("")
        setVisitorEmail("")
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const selectedService = services.find(s => s.id === currentServiceId)

    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 1)
    const minDateStr = minDate.toISOString().split('T')[0]

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
            <DialogContent className="sm:max-w-[480px] bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    {isSuccess ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center justify-center py-12 px-6 space-y-4"
                        >
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-500" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-semibold">Booking Confirmed!</h3>
                                <p className="text-zinc-400">
                                    Your session with {profile.displayName} is booked.<br />
                                    Check your email for details and calendar invite.
                                </p>
                            </div>
                            <Button onClick={handleClose} className="mt-4">Done</Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`step-${step}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <DialogHeader className="p-6 pb-4 border-b border-zinc-800">
                                <div className="flex items-center gap-3">
                                    {step > 1 && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => setStep(step - 1)}
                                            className="h-8 w-8 rounded-full"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <DialogTitle className="text-lg">
                                        {step === 1 && "Choose a Service"}
                                        {step === 2 && "Select Date & Time"}
                                        {step === 3 && "Your Details"}
                                    </DialogTitle>
                                </div>
                                <div className="flex gap-1 mt-4">
                                    {[1, 2, 3].map((s) => (
                                        <div 
                                            key={s} 
                                            className={cn(
                                                "h-1 flex-1 rounded-full transition-colors",
                                                s <= step ? "bg-purple-500" : "bg-zinc-800"
                                            )}
                                        />
                                    ))}
                                </div>
                            </DialogHeader>

                            <div className="p-6 space-y-4">
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
                                                            ? "border-purple-500 bg-purple-500/10" 
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
                                                                {service.isFree ? "Free" : `$${(service.priceCents / 100).toFixed(0)}`}
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
                                        <Button 
                                            className="w-full mt-4" 
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
                                                    <Calendar className="w-5 h-5 text-purple-400" />
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
                                                        <Loader2 className="animate-spin text-purple-400" />
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
                                                                        ? "bg-purple-600 hover:bg-purple-500 border-purple-500" 
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
                                            className="w-full" 
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
                                                    <span className="text-zinc-400">Service</span>
                                                    <span className="font-medium">{selectedService.name}</span>
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
                                                        {selectedService.isFree ? "Free" : `$${(selectedService.priceCents / 100).toFixed(0)}`}
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
                                            className="w-full bg-purple-600 hover:bg-purple-500" 
                                            onClick={handleSubmit} 
                                            disabled={isSubmitting || !visitorName || !visitorEmail}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                                    Confirming...
                                                </>
                                            ) : (
                                                selectedService?.isFree ? "Confirm Booking" : "Continue to Payment"
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
