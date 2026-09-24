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
  async redirects() {
    return [
      { source: "/signup", destination: "/sign-up", permanent: true },
      { source: "/signin", destination: "/sign-in", permanent: true },
      { source: "/login", destination: "/sign-in", permanent: true },
      // P1-2 SHOP marketing aliases → canonical try-shop (dedicated kits like try-boutique/try-kirana stay).
      { source: "/try-grocery", destination: "/try-shop", permanent: false },
      { source: "/try-retail", destination: "/try-shop", permanent: false },
      { source: "/try-jewellery", destination: "/try-shop", permanent: false },
      { source: "/try-fashion", destination: "/try-shop", permanent: false },
      { source: "/try-electronics", destination: "/try-shop", permanent: false },
      { source: "/try-wholesale", destination: "/try-shop", permanent: false },
      { source: "/try-market", destination: "/try-shop", permanent: false },
      // HOTEL P1-3 stay discovery aliases → canonical try-hotel (Haven Hinoo).
      { source: "/hotel", destination: "/try-hotel", permanent: false },
      { source: "/hotel/:path*", destination: "/try-hotel/:path*", permanent: false },
      { source: "/try-stay", destination: "/try-hotel", permanent: false },
      { source: "/try-stay/:path*", destination: "/try-hotel/:path*", permanent: false },
      { source: "/try-bnb", destination: "/try-hotel", permanent: false },
      { source: "/try-bnb/:path*", destination: "/try-hotel/:path*", permanent: false },
      // CREATOR P1-1 discovery aliases → LIVE showcases (Tagore / Riley / Leela / …).
      { source: "/try-creator", destination: "/tagore-hill-press", permanent: false },
      { source: "/try-creator/:path*", destination: "/tagore-hill-press/:path*", permanent: false },
      { source: "/creator", destination: "/tagore-hill-press", permanent: false },
      { source: "/creator/:path*", destination: "/tagore-hill-press/:path*", permanent: false },
      { source: "/try-arjun", destination: "/tagore-hill-press", permanent: false },
      { source: "/try-arjun/:path*", destination: "/tagore-hill-press/:path*", permanent: false },
      { source: "/try-coach", destination: "/leela-path-lalpur", permanent: false },
      { source: "/try-coach/:path*", destination: "/leela-path-lalpur/:path*", permanent: false },
      { source: "/coach", destination: "/leela-path-lalpur", permanent: false },
      { source: "/coach/:path*", destination: "/leela-path-lalpur/:path*", permanent: false },
      { source: "/try-consultant", destination: "/demo", permanent: false },
      { source: "/try-consultant/:path*", destination: "/demo/:path*", permanent: false },
      { source: "/consultant", destination: "/demo", permanent: false },
      { source: "/consultant/:path*", destination: "/demo/:path*", permanent: false },
      { source: "/try-professional", destination: "/demo", permanent: false },
      { source: "/try-professional/:path*", destination: "/demo/:path*", permanent: false },
      { source: "/professional", destination: "/demo", permanent: false },
      { source: "/professional/:path*", destination: "/demo/:path*", permanent: false },
      { source: "/try-designer", destination: "/maya", permanent: false },
      { source: "/try-designer/:path*", destination: "/maya/:path*", permanent: false },
      { source: "/try-developer", destination: "/kadru-lab", permanent: false },
      { source: "/try-developer/:path*", destination: "/kadru-lab/:path*", permanent: false },
      { source: "/try-editor", destination: "/swaroop-production-doranda", permanent: false },
      { source: "/try-editor/:path*", destination: "/swaroop-production-doranda/:path*", permanent: false },
      { source: "/try-photographer", destination: "/lets-click-ratu-road", permanent: false },
      { source: "/try-photographer/:path*", destination: "/lets-click-ratu-road/:path*", permanent: false },
      { source: "/try-ca", destination: "/singh-raushan-doranda", permanent: false },
      { source: "/try-ca/:path*", destination: "/singh-raushan-doranda/:path*", permanent: false },
      // SALON P1-1 discovery aliases -> LIVE showcases (H Square / Prince).
      { source: "/try-salon", destination: "/h-square-salon-harmu", permanent: false },
      { source: "/try-salon/:path*", destination: "/h-square-salon-harmu/:path*", permanent: false },
      { source: "/salon", destination: "/h-square-salon-harmu", permanent: false },
      { source: "/salon/:path*", destination: "/h-square-salon-harmu/:path*", permanent: false },
      { source: "/try-spa", destination: "/h-square-salon-harmu", permanent: false },
      { source: "/try-spa/:path*", destination: "/h-square-salon-harmu/:path*", permanent: false },
      { source: "/spa", destination: "/h-square-salon-harmu", permanent: false },
      { source: "/spa/:path*", destination: "/h-square-salon-harmu/:path*", permanent: false },
      { source: "/try-barber", destination: "/prince-barber-lalpur", permanent: false },
      { source: "/try-barber/:path*", destination: "/prince-barber-lalpur/:path*", permanent: false },
      { source: "/barber", destination: "/prince-barber-lalpur", permanent: false },
      { source: "/barber/:path*", destination: "/prince-barber-lalpur/:path*", permanent: false },
      // GYM P1-1 discovery aliases -> LIVE showcases (Aura / Natraj).
      { source: "/try-gym", destination: "/aura-fitness-ranchi", permanent: false },
      { source: "/try-gym/:path*", destination: "/aura-fitness-ranchi/:path*", permanent: false },
      { source: "/gym", destination: "/aura-fitness-ranchi", permanent: false },
      { source: "/gym/:path*", destination: "/aura-fitness-ranchi/:path*", permanent: false },
      { source: "/try-fitness", destination: "/aura-fitness-ranchi", permanent: false },
      { source: "/try-fitness/:path*", destination: "/aura-fitness-ranchi/:path*", permanent: false },
      { source: "/try-yoga", destination: "/natraj-yoga-kutchery", permanent: false },
      { source: "/try-yoga/:path*", destination: "/natraj-yoga-kutchery/:path*", permanent: false },
      { source: "/yoga", destination: "/natraj-yoga-kutchery", permanent: false },
      { source: "/yoga/:path*", destination: "/natraj-yoga-kutchery/:path*", permanent: false },
      // CLINIC P1-1 discovery aliases -> LIVE showcase (JK Sharma Harmu).
      { source: "/try-clinic", destination: "/jk-sharma-clinic-harmu", permanent: false },
      { source: "/try-clinic/:path*", destination: "/jk-sharma-clinic-harmu/:path*", permanent: false },
      { source: "/clinic", destination: "/jk-sharma-clinic-harmu", permanent: false },
      { source: "/clinic/:path*", destination: "/jk-sharma-clinic-harmu/:path*", permanent: false },
      { source: "/try-dental", destination: "/jk-sharma-clinic-harmu", permanent: false },
      { source: "/try-dental/:path*", destination: "/jk-sharma-clinic-harmu/:path*", permanent: false },
      { source: "/dental", destination: "/jk-sharma-clinic-harmu", permanent: false },
      { source: "/dental/:path*", destination: "/jk-sharma-clinic-harmu/:path*", permanent: false },
      { source: "/try-doctor", destination: "/jk-sharma-clinic-harmu", permanent: false },
      { source: "/try-doctor/:path*", destination: "/jk-sharma-clinic-harmu/:path*", permanent: false },
      { source: "/doctor", destination: "/jk-sharma-clinic-harmu", permanent: false },
      { source: "/doctor/:path*", destination: "/jk-sharma-clinic-harmu/:path*", permanent: false },
      // EVENTS P1-2 discovery aliases -> LIVE showcases (Next Level Events / Let's Click).
      // try-photographer already shipped under CREATOR P1-1 (not duplicated here).
      { source: "/try-events", destination: "/next-level-events-kanke", permanent: false },
      { source: "/try-events/:path*", destination: "/next-level-events-kanke/:path*", permanent: false },
      { source: "/try-event", destination: "/next-level-events-kanke", permanent: false },
      { source: "/try-event/:path*", destination: "/next-level-events-kanke/:path*", permanent: false },
      { source: "/events", destination: "/next-level-events-kanke", permanent: false },
      { source: "/events/:path*", destination: "/next-level-events-kanke/:path*", permanent: false },
      { source: "/try-studio", destination: "/next-level-events-kanke", permanent: false },
      { source: "/try-studio/:path*", destination: "/next-level-events-kanke/:path*", permanent: false },
      { source: "/try-photo", destination: "/lets-click-ratu-road", permanent: false },
      { source: "/try-photo/:path*", destination: "/lets-click-ratu-road/:path*", permanent: false },
      { source: "/photo", destination: "/lets-click-ratu-road", permanent: false },
      { source: "/photo/:path*", destination: "/lets-click-ratu-road/:path*", permanent: false },
      { source: "/photographer", destination: "/lets-click-ratu-road", permanent: false },
      { source: "/photographer/:path*", destination: "/lets-click-ratu-road/:path*", permanent: false },
      // REALESTATE P1-2 discovery aliases -> LIVE showcase (Shakti Property Lalpur).
      { source: "/try-real-estate", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/try-real-estate/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/try-realtor", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/try-realtor/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/realtor", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/realtor/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/try-property", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/try-property/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/property", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/property/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/try-broker", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/try-broker/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/broker", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/broker/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/try-homes", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/try-homes/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      { source: "/realestate", destination: "/shakti-property-lalpur", permanent: false },
      { source: "/realestate/:path*", destination: "/shakti-property-lalpur/:path*", permanent: false },
      // FIELD P1-1 discovery aliases -> LIVE showcase (Goodwill Plumbing).
      { source: "/try-plumber", destination: "/goodwill-plumbing", permanent: false },
      { source: "/try-plumber/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/plumber", destination: "/goodwill-plumbing", permanent: false },
      { source: "/plumber/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/try-electrician", destination: "/goodwill-plumbing", permanent: false },
      { source: "/try-electrician/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/electrician", destination: "/goodwill-plumbing", permanent: false },
      { source: "/electrician/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/try-field", destination: "/goodwill-plumbing", permanent: false },
      { source: "/try-field/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/try-garage", destination: "/goodwill-plumbing", permanent: false },
      { source: "/try-garage/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/garage", destination: "/goodwill-plumbing", permanent: false },
      { source: "/garage/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/try-ac-repair", destination: "/goodwill-plumbing", permanent: false },
      { source: "/try-ac-repair/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
      { source: "/try-repair", destination: "/goodwill-plumbing", permanent: false },
      { source: "/try-repair/:path*", destination: "/goodwill-plumbing/:path*", permanent: false },
    ];
  },
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
