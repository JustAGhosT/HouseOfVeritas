"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { VehiclesPage } from "@/components/shared/vehicles-page"

export default function LuckyVehiclesPage() {
  return (
    <DashboardLayout persona="lucky">
      <VehiclesPage title="Vehicles" />
    </DashboardLayout>
  )
}
