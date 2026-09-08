import { ImageResponse } from "next/og"

export const alt = "Introify. One home for what you do. Profile, bookings, and products."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
    return new ImageResponse(
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#f8f7f4", color: "#172523", fontFamily: "sans-serif", padding: "62px 66px" }}>
            <div style={{ display: "flex", flexDirection: "column", width: 650 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
                    <div style={{ display: "flex", width: 17, height: 17, borderRadius: 9, background: "#1f5eff" }} />
                    Introify
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 84, fontSize: 76, fontWeight: 700, letterSpacing: -4, lineHeight: 1.07 }}>
                    <div style={{ display: "flex" }}>One home for</div>
                    <div style={{ display: "flex" }}>what you do.</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 27, fontSize: 23, lineHeight: 1.5, color: "#53615d", maxWidth: 520 }}>
                    <div style={{ display: "flex" }}>Your profile, products and bookings.</div>
                    <div style={{ display: "flex" }}>A clear next step for every visitor.</div>
                </div>
                <div style={{ display: "flex", marginTop: "auto", fontSize: 20, color: "#53615d" }}>introify.com</div>
            </div>
            <div style={{ display: "flex", position: "absolute", right: 67, top: 108, width: 344, height: 430 }}>
                <div style={{ display: "flex", position: "absolute", top: 0, right: 0, width: 305, height: 146, flexDirection: "column", background: "#ffffff", border: "1px solid #e3e7e1", borderRadius: 22, padding: 25, transform: "rotate(5deg)", boxShadow: "0 16px 34px rgba(23,37,35,0.07)" }}>
                    <div style={{ display: "flex", fontSize: 13, letterSpacing: 2, color: "#697571" }}>01 / PROFILE</div>
                    <div style={{ display: "flex", marginTop: 16, fontSize: 27, fontWeight: 700 }}>Tell your story.</div>
                    <div style={{ display: "flex", marginTop: 13, gap: 8 }}>
                        <div style={{ display: "flex", width: 86, height: 6, borderRadius: 3, background: "#e2e8e3" }} />
                        <div style={{ display: "flex", width: 46, height: 6, borderRadius: 3, background: "#e2e8e3" }} />
                    </div>
                </div>
                <div style={{ display: "flex", position: "absolute", top: 142, left: 0, width: 326, height: 142, flexDirection: "column", background: "#1f5eff", color: "#ffffff", borderRadius: 22, padding: 25, transform: "rotate(-4deg)", boxShadow: "0 16px 34px rgba(23,37,35,0.12)" }}>
                    <div style={{ display: "flex", fontSize: 13, letterSpacing: 2, color: "#dfe8ff" }}>02 / BOOKINGS</div>
                    <div style={{ display: "flex", marginTop: 16, fontSize: 27, fontWeight: 700 }}>Make the next move.</div>
                    <div style={{ display: "flex", marginTop: 13, gap: 7 }}>
                        {[0, 1, 2, 3, 4, 5].map((day) => <div key={day} style={{ display: "flex", width: 20, height: 8, borderRadius: 3, background: day === 2 ? "#d7ee89" : "#658fff" }} />)}
                    </div>
                </div>
                <div style={{ display: "flex", position: "absolute", top: 295, right: 0, width: 305, height: 140, flexDirection: "column", background: "#d7ee89", borderRadius: 22, padding: 25, transform: "rotate(3deg)", boxShadow: "0 16px 34px rgba(23,37,35,0.07)" }}>
                    <div style={{ display: "flex", fontSize: 13, letterSpacing: 2, color: "#495733" }}>03 / PRODUCTS</div>
                    <div style={{ display: "flex", marginTop: 16, fontSize: 27, fontWeight: 700 }}>Bring your offers.</div>
                </div>
            </div>
        </div>,
        size,
    )
}
