import { ComplianceSection } from "@/components/compliance-section"
import { DashboardPreview } from "@/components/dashboard-preview"
import { FeatureModules } from "@/components/feature-modules"
import { FinalCTA } from "@/components/final-cta"
import { Footer } from "@/components/footer"
import { GridPattern } from "@/components/grid-pattern"
import { Hero } from "@/components/hero"
import { LoginRedirectHandler } from "@/components/login-redirect-handler"
import { Navbar } from "@/components/navbar"
import { RoleDashboards } from "@/components/role-dashboards"
import { SmoothScroll } from "@/components/smooth-scroll"
import { StatsSection } from "@/components/stats-section"
import { Suspense } from "react"

export default function Home() {
  return (
    <SmoothScroll>
      <main className="relative bg-background">
        <GridPattern />
        <div className="relative z-10 flex flex-col min-h-screen">
          <Suspense fallback={null}>
            <LoginRedirectHandler />
          </Suspense>
          <Navbar />
          <Hero />
          <StatsSection />
          <div className="ornate-divider"><div className="ornate-divider-mark" /></div>
          <FeatureModules />
          <div className="ornate-divider"><div className="ornate-divider-mark" /></div>
          <DashboardPreview />
          <RoleDashboards />
          <div className="ornate-divider"><div className="ornate-divider-mark" /></div>
          <ComplianceSection />
          <FinalCTA />
          <Footer />
        </div>
      </main>
    </SmoothScroll>
  )
}
