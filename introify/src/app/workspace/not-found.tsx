import Link from "next/link"

export default function NotFound() {
  return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>404</div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Page not found</h1>
      <p style={{ color: "var(--w-mut)", marginBottom: 24 }}>
        The workspace page you're looking for doesn't exist.
      </p>
      <Link href="/workspace" className="w-btn">
        ← Back to workspace
      </Link>
    </div>
  )
}
