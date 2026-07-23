"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { VehiclesPage } from "@/components/shared/vehicles-page"

export default function CharlVehiclesPage() {
  return (
    <DashboardLayout persona="charl">
      <VehiclesPage title="Vehicles" />
    </DashboardLayout>
  )
}
