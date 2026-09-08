import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "Introify — Big things start with a good intro. Your profile, work and bookings in one link."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
    const logo = await readFile(join(process.cwd(), "public/brand/introify-signature.svg"))
    return new ImageResponse(
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#073d30", color: "#f5f6e9", fontFamily: "sans-serif", padding: "50px 64px" }}>
            <div style={{ display: "flex", flexDirection: "column", width: 780 }}>
                {/* A bundled outlined SVG keeps the shared image identical to the brand. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/svg+xml;base64,${logo.toString("base64")}`} alt="Introify" width={165} height={51} />
                <div style={{ display: "flex", flexDirection: "column", marginTop: 62, fontSize: 85, fontWeight: 700, letterSpacing: -5, lineHeight: 1.03 }}>
                    <div style={{ display: "flex" }}>Big things start</div>
                    <div style={{ display: "flex", color: "#b8e274" }}>with a good intro.</div>
                </div>
                <div style={{ display: "flex", marginTop: 28, fontSize: 22, lineHeight: 1.5, color: "#c4d5b9", maxWidth: 570 }}>Your profile, work and bookings. One page that feels like you.</div>
                <div style={{ display: "flex", marginTop: "auto", fontSize: 17, color: "#c4d5b9" }}>introify.com</div>
            </div>
            <div style={{ display: "flex", position: "absolute", right: 65, top: 110, width: 264, height: 390, background: "#f4f4e8", color: "#173f2d", borderRadius: 18, padding: "24px 25px", transform: "rotate(8deg)", flexDirection: "column", boxShadow: "0 18px 45px rgba(0,30,20,.25)" }}>
                <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: "#5c7650" }}>ONE LINK. MORE YOU.</div>
                <div style={{ display: "flex", marginTop: 24, fontSize: 35, lineHeight: 1.05, fontWeight: 700, letterSpacing: -1.5 }}>Your story. Your way.</div>
                {["Your story", "Your work", "Let’s connect"].map((label, index) => <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", marginTop: index === 0 ? 25 : 8, borderRadius: 7, background: index === 2 ? "#a3db42" : "#e4eacf", fontSize: 13 }}><span>{label}</span><span>↗</span></div>)}
            </div>
            <div style={{ display: "flex", position: "absolute", right: 41, bottom: 67, width: 100, height: 100, alignItems: "center", justifyContent: "center", borderRadius: 50, background: "#a3db42", color: "#16402b" }}><svg viewBox="0 0 100 100" width="55" height="55" fill="none"><path d="M50 4v92M4 50h92M17.5 17.5l65 65m0-65-65 65" stroke="#16402b" strokeWidth="12" strokeLinecap="round" /></svg></div>
        </div>,
        size,
    )
}
