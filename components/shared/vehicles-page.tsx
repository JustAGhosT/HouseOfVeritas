import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Car, Clock, Route, ShieldCheck } from "lucide-react"

interface VehiclesPageProps {
  title?: string
  showAll?: boolean
}

export function VehiclesPage({
  title = "Vehicles",
  showAll = false,
}: VehiclesPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Car className="h-7 w-7 text-primary" />
          {title}
          <Badge variant="secondary">Coming soon</Badge>
        </h1>
        <p className="mt-1 text-muted-foreground">
          {showAll
            ? "Fleet logs, mileage tracking, and compliance checks are not live yet."
            : "Vehicle trip logging is not live yet."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <Clock className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Trip logging</p>
            <p className="text-lg font-semibold text-foreground">Coming soon</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <Route className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Mileage and fuel</p>
            <p className="text-lg font-semibold text-foreground">Coming soon</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Compliance checks</p>
            <p className="text-lg font-semibold text-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Vehicle module</CardTitle>
          <CardDescription className="text-muted-foreground">
            This area is intentionally parked until vehicle operations are ready to ship.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="font-medium text-foreground">Vehicles are coming soon</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No vehicle logs, odometer readings, fuel costs, or compliance tasks are active in the app right now.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
