import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { ClerkChrome } from "@/components/auth/clerk-chrome";
import { ThemeProvider } from "@/components/theme-provider";
import { PricingProvider } from "@/components/pricing-provider";
import { getRequestCurrency } from "@/lib/request-currency";
import { Toaster } from "sonner";
import { BRAND_DESCRIPTION, marketingOrigin } from "@/lib/marketing-seo";
import { PageTransitionProvider } from "@/components/navigation/page-transition";
import { getRequestLocale } from "@/lib/ui-locale-request";
import { htmlLang } from "@/lib/ui-locale";
import "@/components/navigation/page-transition.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari", "latin"],
});

export const dynamic = 'force-dynamic'

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(marketingOrigin()),
  title: "Introify",
  description:
    BRAND_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [currency, locale] = await Promise.all([getRequestCurrency(), getRequestLocale()])
  return (
    <html lang={htmlLang(locale)} dir="ltr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} antialiased`}
        suppressHydrationWarning
      >
        <ClerkProvider
          appearance={clerkAppearance}
          dynamic
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/onboarding"
          afterSignOutUrl="/"
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="pl-theme"
            disableTransitionOnChange
          >
            <PricingProvider currency={currency}>
              <PageTransitionProvider>{children}</PageTransitionProvider>
              <ClerkChrome />
              <Toaster theme="system" />
            </PricingProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
