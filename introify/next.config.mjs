import { execFileSync } from "node:child_process";

let release = process.env.INTROIFY_RELEASE_SHA || "";
if (!/^[a-f0-9]{40}$/.test(release)) {
  try { release = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { release = "unknown"; }
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  env: { INTROIFY_RELEASE_SHA: /^[a-f0-9]{40}$/.test(release) ? release : "unknown" },
  transpilePackages: ["three"],
  allowedDevOrigins: [
    "localhost",
    "*.localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/uploads/:path*",
          destination: "/api/uploads/:path*",
        },
      ],
    };
  },
  async headers() {
    return [
      ...[
        "/dashboard/:path*",
        "/admin/:path*",
        "/onboarding/:path*",
        "/qa/:path*",
        "/library/:path*",
        "/sign-in/:path*",
        "/sign-up/:path*",
        "/api/:path*",
        "/o/:path*",
        "/l/:path*",
        "/:slug/lift/:path*",
      ].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        ],
      },
      {
        // iOS AR Quick Look only takes over the link when the response carries
        // the USDZ media type. Served as application/octet-stream, Safari just
        // downloads the file and no AR session ever starts.
        source: "/:path*.usdz",
        headers: [
          { key: "Content-Type", value: "model/vnd.usdz+zip" },
          { key: "Content-Disposition", value: 'inline; filename="model.usdz"' },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        // Scene Viewer fetches the model itself, from Google's app rather than
        // the page, so it needs its own long-lived cache policy too.
        source: "/uploads/:path*.glb",
        headers: [
          { key: "Content-Type", value: "model/gltf-binary" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
