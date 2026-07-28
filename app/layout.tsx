import type React from "react"
import type { Metadata } from "next"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/error-boundary"
import { CustomCursor } from "@/components/custom-cursor"
import "./globals.css"

export const viewport = {
  themeColor: "#0F0F12",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "House of Veritas - Digital Governance & Estate Management",
  description:
    "Secure platform for estate management, document compliance, and operational accountability. BCEA-compliant with full audit trails.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "House of Veritas",
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192x192.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" data-user-theme="sanctum">
      <body className="font-sans antialiased">
        <div className="noise-overlay" aria-hidden="true" />
        <div className="ritual-glow" aria-hidden="true" />
        <CustomCursor />
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}
