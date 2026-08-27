import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Structural skeleton mirroring BusinessOsShell's layout (header, four stat
 * cards, engine coverage grid, blueprint list) so the route doesn't render a
 * blank frame while data loads.
 */
export default function BusinessOsLoading() {
    return (
        <div className="flex-1 space-y-6" aria-busy="true" aria-label="Loading Business OS">
            <PageHeader
                title="Business OS"
                description="Versioned blueprints composed from the shared operating engines."
            />

            <Skeleton className="h-10 w-full rounded-xl" />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="size-4 rounded-full" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-7 w-12" />
                            <Skeleton className="h-3 w-16" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-28" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3">
                            <Skeleton className="h-4 w-1/3" />
                            <div className="grid gap-3 md:grid-cols-2">
                                <Skeleton className="h-16 w-full rounded-xl" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
