"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { CastingPlanner } from "@/components/casting-planner"

export default function HansCastingPage() {
  return (
    <DashboardLayout persona="hans">
      <CastingPlanner persona="hans" />
    </DashboardLayout>
  )
}
