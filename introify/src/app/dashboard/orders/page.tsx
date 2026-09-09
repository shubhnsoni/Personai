import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { isRxRequired, parseBuyerPrescription } from "@/lib/pharmacy/batch"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDistanceToNow } from "date-fns"
import { Package, GraduationCap, Calendar, Users, DollarSign } from "lucide-react"
import { ResendLibraryLink } from "@/components/dashboard/resend-library-link"
import { ConfirmOrderButton } from "@/components/dashboard/confirm-order-button"
import { requireSurface } from "@/lib/require-surface"
import { RestaurantOrdersDashboard } from "@/components/dashboard/restaurant-orders-dashboard"
import { DistroOrdersDashboard } from "@/components/dashboard/distro-orders-dashboard"

export const dynamic = 'force-dynamic'

export default async function DashboardOrdersPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    if (!user.activeProfile) redirect("/onboarding")

    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "shop", profile)

    if (profile.roleTemplate === "RESTAURANT") {
        return <RestaurantOrdersDashboard profileId={profile.id} slug={profile.slug} />
    }
    if (profile.roleTemplate === "DISTRIBUTOR") {
        return <DistroOrdersDashboard profileId={profile.id} />
    }

    const [productPurchases, courseEnrollments, eventRegistrations, communityMembers, payments] = await Promise.all([
        prisma.productPurchase.findMany({
            where: { product: { profileId: profile.id } },
            include: { product: true },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.courseEnrollment.findMany({
            where: { course: { profileId: profile.id } },
            include: { course: true },
            orderBy: { enrolledAt: 'desc' }
        }),
        prisma.eventRegistration.findMany({
            where: { event: { profileId: profile.id } },
            include: { event: true },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.communityMember.findMany({
            where: { community: { profileId: profile.id } },
            include: { community: true },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.payment.findMany({
            where: { 
                profileId: profile.id,
                status: 'SUCCEEDED'
            },
            orderBy: { createdAt: 'desc' }
        })
    ])

    const totalRevenue = payments.reduce((sum, p) => sum + p.amountCents, 0)

    return (
        <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Orders and enrollments</p>
            </div>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2 pb-1">
                        <CardTitle className="text-[12px] font-medium text-muted-foreground">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0">
                        <div className="text-lg font-semibold tabular-nums">${(totalRevenue / 100).toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2 pb-1">
                        <CardTitle className="text-[12px] font-medium text-muted-foreground">Products Sold</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0">
                        <div className="text-lg font-semibold tabular-nums">{productPurchases.filter(p => p.status === 'COMPLETED').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2 pb-1">
                        <CardTitle className="text-[12px] font-medium text-muted-foreground">Course Enrollments</CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0">
                        <div className="text-lg font-semibold tabular-nums">{courseEnrollments.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2 pb-1">
                        <CardTitle className="text-[12px] font-medium text-muted-foreground">Event Registrations</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0">
                        <div className="text-lg font-semibold tabular-nums">{eventRegistrations.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2 pb-1">
                        <CardTitle className="text-[12px] font-medium text-muted-foreground">Community Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0">
                        <div className="text-lg font-semibold tabular-nums">{communityMembers.filter(m => m.status === 'ACTIVE').length}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="products" className="space-y-2">
                <TabsList>
                    <TabsTrigger value="products"><Package /><span>Products {productPurchases.length}</span></TabsTrigger>
                    <TabsTrigger value="courses"><GraduationCap /><span>Courses {courseEnrollments.length}</span></TabsTrigger>
                    <TabsTrigger value="events"><Calendar /><span>Events {eventRegistrations.length}</span></TabsTrigger>
                    <TabsTrigger value="communities"><Users /><span>Communities {communityMembers.length}</span></TabsTrigger>
                </TabsList>

                <TabsContent value="products">
                    {productPurchases.some((p) => p.status === "PENDING" && (isRxRequired(p.product.variantsJson) || Boolean(parseBuyerPrescription(p.buyerNote).url))) ? (
                        <Card className="mb-2 border-amber-500/40">
                            <CardHeader>
                                <CardTitle className="text-[13px]">Pending Rx review</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 px-3 pb-3">
                                {productPurchases.filter((p) => p.status === "PENDING" && (isRxRequired(p.product.variantsJson) || Boolean(parseBuyerPrescription(p.buyerNote).url))).map((purchase) => {
                                    const rx = parseBuyerPrescription(purchase.buyerNote)
                                    return (
                                        <div key={`rx-${purchase.id}`} className="flex items-center justify-between rounded-lg bg-amber-500/10 px-2.5 py-2">
                                            <div>
                                                <p className="font-medium">{purchase.product.title}</p>
                                                <p className="text-sm text-muted-foreground">{purchase.visitorName || purchase.visitorEmail}</p>
                                                {rx.url ? <a href={rx.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 text-[11px] text-muted-foreground no-underline">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={rx.url} alt="" width={28} height={28} className="h-[28px] w-[28px] rounded object-cover" />
                                                    <span>Rx attached</span>
                                                </a> : null}
                                                {rx.note ? <p className="text-[11px] text-muted-foreground">{rx.note}</p> : null}
                                            </div>
                                            <ConfirmOrderButton purchaseId={purchase.id} showReject />
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    ) : null}
                    <Card>
                        <CardHeader className="px-3 py-2.5">
                            <CardTitle className="text-[13px]">Product Purchases</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                            {productPurchases.length === 0 ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">No product purchases yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {productPurchases.map((purchase) => (
                                        <div key={purchase.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-2">
                                            <div className="flex items-center gap-2.5">
                                                <Package className="h-5 w-5 text-purple-500" />
                                                <div>
                                                    <p className="font-medium">{purchase.product.title}</p>
                                                    <p className="text-sm text-muted-foreground">{purchase.visitorEmail}</p>
                                                    {(() => {
                                                        const rx = parseBuyerPrescription(purchase.buyerNote)
                                                        const needs = isRxRequired(purchase.product.variantsJson)
                                                        if (!needs && !rx.url && !rx.note) return null
                                                        return (
                                                            <div className="mt-1 space-y-0.5">
                                                                {needs ? <p className="text-[11px] font-medium text-amber-700">Rx review</p> : null}
                                                                {rx.url ? (
                                                                    <a href={rx.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[11px] text-muted-foreground no-underline">
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img src={rx.url} alt="" width={28} height={28} className="h-[28px] w-[28px] rounded object-cover" />
                                                                        <span>Rx attached</span>
                                                                    </a>
                                                                ) : null}
                                                                {rx.note ? <p className="text-[11px] text-muted-foreground">{rx.note}</p> : null}
                                                            </div>
                                                        )
                                                    })()}
                                                    <ResendLibraryLink email={purchase.visitorEmail} />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={purchase.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                                    {purchase.status}{purchase.payMethod ? ` · ${purchase.payMethod}` : ""}
                                                </Badge>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(purchase.createdAt), { addSuffix: true })}
                                                </p>
                                                {purchase.status === "PENDING" ? <ConfirmOrderButton purchaseId={purchase.id} showReject={isRxRequired(purchase.product.variantsJson) || Boolean(parseBuyerPrescription(purchase.buyerNote).url)} /> : null}
                                                <a href={`/dashboard/orders/${purchase.id}/receipt`} className="mt-2 block text-[11px] text-muted-foreground underline">
                                                    Receipt
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="courses">
                    <Card>
                        <CardHeader className="px-3 py-2.5">
                            <CardTitle className="text-[13px]">Course Enrollments</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                            {courseEnrollments.length === 0 ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">No course enrollments yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {courseEnrollments.map((enrollment) => (
                                        <div key={enrollment.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-2">
                                            <div className="flex items-center gap-2.5">
                                                <GraduationCap className="h-5 w-5 text-blue-500" />
                                                <div>
                                                    <p className="font-medium">{enrollment.course.title}</p>
                                                    <p className="text-sm text-muted-foreground">{enrollment.visitorEmail}</p>
                                                    <ResendLibraryLink email={enrollment.visitorEmail} />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={enrollment.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                    {enrollment.status}
                                                </Badge>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(enrollment.enrolledAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="events">
                    <Card>
                        <CardHeader className="px-3 py-2.5">
                            <CardTitle className="text-[13px]">Event Registrations</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                            {eventRegistrations.length === 0 ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">No event registrations yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {eventRegistrations.map((registration) => (
                                        <div key={registration.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-2">
                                            <div className="flex items-center gap-2.5">
                                                <Calendar className="h-5 w-5 text-green-500" />
                                                <div>
                                                    <p className="font-medium">{registration.event.title}</p>
                                                    <p className="text-sm text-muted-foreground">{registration.visitorEmail}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={registration.status === 'REGISTERED' ? 'default' : 'secondary'}>
                                                    {registration.status}
                                                </Badge>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(registration.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="communities">
                    <Card>
                        <CardHeader className="px-3 py-2.5">
                            <CardTitle className="text-[13px]">Community Members</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                            {communityMembers.length === 0 ? (
                                <p className="py-4 text-center text-sm text-muted-foreground">No community members yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {communityMembers.map((member) => (
                                        <div key={member.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-2">
                                            <div className="flex items-center gap-2.5">
                                                <Users className="h-5 w-5 text-orange-500" />
                                                <div>
                                                    <p className="font-medium">{member.community.name}</p>
                                                    <p className="text-sm text-muted-foreground">{member.visitorEmail}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                    {member.status}
                                                </Badge>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
