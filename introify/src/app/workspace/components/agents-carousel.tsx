"use client"

import Link from "next/link"
import { useState } from "react"

const agents = [
  { id: "ani", name: "ANI", num: "01", role: "Logo motion & brand animation", color: "#fb6440" },
  { id: "stok", name: "STOK", num: "02", role: "Restaurant operations", color: "#39b77f" },
  { id: "vect", name: "VECT", num: "03", role: "Vector & icon systems", color: "#8775ff" },
  { id: "mock", name: "MOCK", num: "04", role: "Product mockups", color: "#f2b23c" },
]

export function AgentsCarousel() {
  const [idx, setIdx] = useState(0)
  const a = agents[idx]

  return (
    <div style={{ border: "1px solid var(--w-line)", borderRadius: 18, overflow: "hidden" }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${a.color} 0%, ${a.color}44 100%)`,
          padding: "32px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          minHeight: 190,
        }}
      >
        <div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.85)", letterSpacing: ".1em" }}>
            AGENT · {a.num}
          </span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "6px 0 4px" }}>{a.name}</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,.88)", maxWidth: 380 }}>{a.role}</div>
          <div style={{ marginTop: 14 }}>
            <Link href={`/workspace/agent/${a.id}`} className="w-btn">
              View {a.name} →
            </Link>
          </div>
        </div>
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, #ffffff44, ${a.color}66)`,
            boxShadow: "inset 0 -12px 30px #00000018",
            flexShrink: 0,
            border: "3px solid rgba(255,255,255,.45)",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, padding: "12px 16px", borderTop: "1px solid var(--w-line)", background: "#fff" }}>
        {agents.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setIdx(i)}
            style={{
              flex: 1,
              padding: "10px 6px",
              borderRadius: 10,
              border: i === idx ? `1px solid ${x.color}` : "1px solid var(--w-line)",
              background: i === idx ? "#fff" : "transparent",
              color: i === idx ? "#222" : "#717171",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {x.num} {x.name}
          </button>
        ))}
      </div>
    </div>
  )
}
