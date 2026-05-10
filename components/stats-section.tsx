"use client"

import { apiFetchSafe } from "@/lib/api-client"
import { useMotion } from "@/lib/motion-context"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface Stats {
  users?: { total: number; active: number; names: string[] }
  tasks?: { total: number; completed: number; inProgress: number; overdue: number }
  expenses?: { thisMonth: number; pending: number; approved: number }
  budget?: { allocated: number; spent: number; remaining: number; percentage: number }
}

export function StatsSection() {
  const [stats, setStats] = useState<Stats | null>(null)
  const { motionEnabled } = useMotion()

  useEffect(() => {
    apiFetchSafe<Stats | null>("/api/stats", null, { label: "Stats" }).then(setStats)
  }, [])

  if (!stats) return null

  const users = stats.users ?? { total: 0, active: 0, names: [] }
  const tasks = stats.tasks ?? { total: 0, completed: 0, inProgress: 0, overdue: 0 }
  const budget = stats.budget ?? { allocated: 0, spent: 0, remaining: 0, percentage: 0 }

  const statsData = [
    {
      value: tasks.total,
      label: "Tasks",
      sublabel: `${tasks.completed} completed`,
      color: "text-primary",
    },
    {
      value: users.active,
      label: "Active Users",
      sublabel: users.names?.join(", ") ?? "—",
      color: "text-secondary",
    },
    {
      value: `${budget.percentage}%`,
      label: "Budget Used",
      sublabel: `R${budget.spent?.toLocaleString() ?? 0} of R${budget.allocated?.toLocaleString() ?? 0}`,
      color: "text-accent",
    },
    {
      value: tasks.overdue,
      label: "Overdue Tasks",
      sublabel: "Requires attention",
      color: tasks.overdue > 0 ? "text-accent" : "text-muted-foreground",
    },
  ]

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionEnabled ? { duration: 0.6 } : { duration: 0 }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={motionEnabled ? { duration: 0.6, delay: index * 0.1 } : { duration: 0 }}
              className="relative rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-border/80"
            >
              <div className="text-center">
                <div className={`mb-2 text-4xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="mb-1 text-sm font-semibold text-foreground">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.sublabel}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
