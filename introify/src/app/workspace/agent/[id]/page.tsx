import { redirect } from "next/navigation"

export default async function AgentAliasPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/workspace/ai/${id}`)
}
