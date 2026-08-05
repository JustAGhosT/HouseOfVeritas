"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { CastingPlanner } from "@/components/casting-planner"

export default function CharlCastingPage() {
  return (
    <DashboardLayout persona="charl">
      <CastingPlanner persona="charl" />
    </DashboardLayout>
  )
}
