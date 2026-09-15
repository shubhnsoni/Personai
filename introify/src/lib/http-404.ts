import { NextResponse } from "next/server"

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Page not found | Introify</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#050505; color:#fff; font-family: ui-sans-serif, system-ui, sans-serif; padding:24px; }
    main { text-align:center; max-width:28rem; }
    .code { font-size:clamp(4rem,12vw,6rem); font-weight:750; letter-spacing:-.06em; background:linear-gradient(90deg,#c084fc,#f472b6); -webkit-background-clip:text; background-clip:text; color:transparent; }
    h1 { margin:12px 0 8px; font-size:1.5rem; }
    p { margin:0 0 28px; color:#a1a1aa; line-height:1.6; }
    a { display:inline-flex; align-items:center; min-height:44px; padding:0 18px; border-radius:999px; background:#7c3aed; color:#fff; text-decoration:none; font-weight:600; }
    a:hover { background:#6d28d9; }
    a:focus-visible { outline:3px solid #c084fc; outline-offset:4px; }
  </style>
</head>
<body>
  <main>
    <div class="code" aria-hidden="true">404</div>
    <h1>This Introify is missing</h1>
    <p>That page doesn’t exist or the profile is no longer public.</p>
    <a href="/">Go Home</a>
  </main>
</body>
</html>`

export function http404Response(method = "GET") {
    if (method === "HEAD") {
        return new NextResponse(null, {
            status: 404,
            headers: {
                "content-type": "text/html; charset=utf-8",
                "x-robots-tag": "noindex, nofollow",
                "cache-control": "no-store",
            },
        })
    }
    return new NextResponse(HTML, {
        status: 404,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "x-robots-tag": "noindex, nofollow",
            "cache-control": "no-store",
        },
    })
}
