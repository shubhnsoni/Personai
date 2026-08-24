import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { ClerkChrome } from "@/components/auth/clerk-chrome";
import { ThemeProvider } from "@/components/theme-provider";
import { PricingProvider } from "@/components/pricing-provider";
import { getRequestCurrency } from "@/lib/request-currency";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = 'force-dynamic'

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
}

export const metadata: Metadata = {
  title: {
    default: "PersonaLink",
    template: "%s · PersonaLink",
  },
  description:
    "Your AI-powered professional profile. Chat with visitors, book calls, and sell from one link.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currency = await getRequestCurrency()
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="pl-theme"
            disableTransitionOnChange
          >
            <PricingProvider currency={currency}>
              {children}
              <ClerkChrome />
              <Toaster theme="system" />
            </PricingProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
