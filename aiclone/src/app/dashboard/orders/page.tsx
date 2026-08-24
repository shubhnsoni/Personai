import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDistanceToNow } from "date-fns"
import { Package, GraduationCap, Calendar, Users } from "lucide-react"
import { ResendLibraryLink } from "@/components/dashboard/resend-library-link"
import { ConfirmOrderButton } from "@/components/dashboard/confirm-order-button"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = 'force-dynamic'

export default async function DashboardOrdersPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "shop", profile)

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
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Orders and enrollments</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Products Sold</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productPurchases.filter(p => p.status === 'COMPLETED').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Course Enrollments</CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{courseEnrollments.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Event Registrations</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{eventRegistrations.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Community Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{communityMembers.filter(m => m.status === 'ACTIVE').length}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="products" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="products"><Package /><span>Products {productPurchases.length}</span></TabsTrigger>
                    <TabsTrigger value="courses"><GraduationCap /><span>Courses {courseEnrollments.length}</span></TabsTrigger>
                    <TabsTrigger value="events"><Calendar /><span>Events {eventRegistrations.length}</span></TabsTrigger>
                    <TabsTrigger value="communities"><Users /><span>Communities {communityMembers.length}</span></TabsTrigger>
                </TabsList>

                <TabsContent value="products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Purchases</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {productPurchases.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No product purchases yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {productPurchases.map((purchase) => (
                                        <div key={purchase.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                            <div className="flex items-center gap-4">
                                                <Package className="h-8 w-8 text-purple-500" />
                                                <div>
                                                    <p className="font-medium">{purchase.product.title}</p>
                                                    <p className="text-sm text-muted-foreground">{purchase.visitorEmail}</p>
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
                                                {purchase.status === "PENDING" ? <ConfirmOrderButton purchaseId={purchase.id} /> : null}
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
                        <CardHeader>
                            <CardTitle>Course Enrollments</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {courseEnrollments.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No course enrollments yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {courseEnrollments.map((enrollment) => (
                                        <div key={enrollment.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                            <div className="flex items-center gap-4">
                                                <GraduationCap className="h-8 w-8 text-blue-500" />
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
                        <CardHeader>
                            <CardTitle>Event Registrations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {eventRegistrations.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No event registrations yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {eventRegistrations.map((registration) => (
                                        <div key={registration.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                            <div className="flex items-center gap-4">
                                                <Calendar className="h-8 w-8 text-green-500" />
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
                        <CardHeader>
                            <CardTitle>Community Members</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {communityMembers.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No community members yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {communityMembers.map((member) => (
                                        <div key={member.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                            <div className="flex items-center gap-4">
                                                <Users className="h-8 w-8 text-orange-500" />
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
