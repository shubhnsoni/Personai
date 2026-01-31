"use client"

import { Payment, Booking, ServiceOffering } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PaymentsListProps {
    payments: (Payment & { booking: (Booking & { serviceOffering: ServiceOffering }) | null })[]
}

export function PaymentsList({ payments }: PaymentsListProps) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {payments.map((payment) => (
                    <Card key={payment.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {payment.booking?.visitorName || "Unknown"}
                            </CardTitle>
                            <Badge variant={payment.status === "SUCCEEDED" ? "default" : "secondary"}>
                                {payment.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                ${(payment.amountCents / 100).toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                                {payment.booking?.serviceOffering.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(payment.createdAt))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {payments.length === 0 && (
                    <div className="col-span-full text-center py-12 border rounded-lg border-dashed text-muted-foreground">
                        No payments yet.
                    </div>
                )}
            </div>
        </div>
    )
}
