import { NextResponse } from "next/server"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { withAuth } from "@/lib/auth/rbac"

export const GET = withAuth(async (_request) => {
  const [tasks, expenses, employees] = await Promise.all([
    getEstateRepository().tasks.list(),
    getEstateRepository().expenses.list(),
    getEstateRepository().employees.list(),
  ])

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]

  const monthExpenses = expenses.filter((e) => e.date >= monthStart)

  const stats = {
    dataSource: getEstateRepository().isConfigured()
      ? "live"
      : process.env.ALLOW_DEMO_DATA === "true"
        ? "demo"
        : "empty",
    users: {
      total: employees.length,
      active: employees.length,
      names: employees.map((e) => e.fullName.split(" ")[0]),
    },
    tasks: {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "Completed").length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      overdue: tasks.filter(
        (t) => t.dueDate && t.dueDate < now.toISOString().split("T")[0] && t.status !== "Completed"
      ).length,
    },
    expenses: {
      thisMonth: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      pending: expenses.filter((e) => e.approvalStatus === "Pending").length,
      approved: expenses.filter((e) => e.approvalStatus === "Approved").length,
    },
    budget: {
      allocated: 0,
      spent: monthExpenses
        .filter((e) => e.approvalStatus === "Approved")
        .reduce((sum, e) => sum + e.amount, 0),
      remaining: 0,
      percentage: 0,
    },
  }

  stats.budget.remaining = stats.budget.allocated - stats.budget.spent
  stats.budget.percentage =
    stats.budget.allocated > 0 ? Math.round((stats.budget.spent / stats.budget.allocated) * 100) : 0

  return NextResponse.json(stats)
})
