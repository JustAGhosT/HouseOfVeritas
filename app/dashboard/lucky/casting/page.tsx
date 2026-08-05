"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { CastingPlanner } from "@/components/casting-planner"

export default function LuckyCastingPage() {
  return (
    <DashboardLayout persona="lucky">
      <CastingPlanner persona="lucky" />
    </DashboardLayout>
  )
}
