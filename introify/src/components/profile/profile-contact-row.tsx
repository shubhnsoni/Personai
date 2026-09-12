import { Instagram, Facebook, Youtube, MapPin } from "lucide-react"
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon"
import type { SocialLinks } from "@/lib/socials"

const iconClass = "flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-profile-chip text-profile-text dark:border-white/10"

export function ProfileContactRow({
    name,
    whatsapp,
    socials,
    onWhatsApp,
}: {
    name: string
    whatsapp?: string | null
    socials: SocialLinks
    onWhatsApp?: () => void
}) {
    const waHref = whatsapp
        ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${name}`)}`
        : undefined

    return (
        <nav aria-label="Contact" data-profile-contact className="flex items-center justify-center gap-1.5">
            {waHref ? (
                <a href={waHref} target="_blank" rel="noreferrer" className={iconClass} aria-label="WhatsApp" onClick={onWhatsApp}>
                    <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                </a>
            ) : null}
            {socials.instagram ? (
                <a href={socials.instagram} target="_blank" rel="noreferrer" className={iconClass} aria-label="Instagram">
                    <Instagram className="h-3.5 w-3.5" />
                </a>
            ) : null}
            {socials.facebook ? (
                <a href={socials.facebook} target="_blank" rel="noreferrer" className={iconClass} aria-label="Facebook">
                    <Facebook className="h-3.5 w-3.5" />
                </a>
            ) : null}
            {socials.youtube ? (
                <a href={socials.youtube} target="_blank" rel="noreferrer" className={iconClass} aria-label="YouTube">
                    <Youtube className="h-3.5 w-3.5" />
                </a>
            ) : null}
            {socials.maps ? (
                <a href={socials.maps} target="_blank" rel="noreferrer" className={iconClass} aria-label="Maps">
                    <MapPin className="h-3.5 w-3.5" />
                </a>
            ) : null}
            {socials.zomato ? (
                <a href={socials.zomato} target="_blank" rel="noreferrer" className="flex h-7 items-center rounded-full border border-black/10 bg-profile-chip px-2 text-[10px] font-medium text-profile-text dark:border-white/10" aria-label="Zomato">
                    Zomato
                </a>
            ) : null}
        </nav>
    )
}
