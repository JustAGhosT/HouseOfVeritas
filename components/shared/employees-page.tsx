"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, RefreshCw, Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

interface Employee {
  id: number
  fullName: string
  role: string
  email: string
  phone: string
  leaveBalance?: number
}

interface EmployeesPageProps {
  embedded?: boolean
}

export function EmployeesPage({ embedded = false }: EmployeesPageProps = {}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await apiFetch<{ employees?: Employee[] }>("/api/employees", {
        label: "Employees",
      })
      setEmployees(data?.employees || [])
    } catch (error) {
      logger.error("Failed to fetch employees", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Users className="h-7 w-7 text-primary" />
            Employees
          </h1>
          <p className="mt-1 text-muted-foreground">Employee directory and management</p>
        </div>
      )}

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Employee List</CardTitle>
          <CardDescription className="text-muted-foreground">
            {employees.length} employee{employees.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : employees.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No employees found.</p>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{emp.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {emp.role} · {emp.email}
                    </p>
                  </div>
                  {emp.leaveBalance != null && (
                    <span className="text-sm text-muted-foreground">{emp.leaveBalance} days leave</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" className="border-border hover:bg-muted text-foreground" onClick={fetchEmployees}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
