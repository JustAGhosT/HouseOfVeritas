import type React from "react"
import type { Metadata } from "next"
import { Manrope, Inter, Cinzel, Source_Serif_4 } from "next/font/google"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/error-boundary"
import { CustomCursor } from "@/components/custom-cursor"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-serif",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif-body",
})

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
    <html lang="en" className="dark">
      <body className={`${manrope.variable} ${inter.variable} ${cinzel.variable} ${sourceSerif.variable} font-sans antialiased`}>
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
