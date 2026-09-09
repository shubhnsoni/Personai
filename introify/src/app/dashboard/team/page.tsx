import { getTeamManagement } from "@/app/actions/billing-team"
import { TeamManager } from "@/components/dashboard/team-manager"

export default async function TeamPage() {
    return <TeamManager team={await getTeamManagement()} />
}
