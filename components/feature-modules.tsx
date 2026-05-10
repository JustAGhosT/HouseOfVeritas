"use client"

import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import {
  AlertTriangle,
  Bell,
  Car,
  ClipboardList,
  Clock,
  DollarSign,
  FileSignature,
  Package,
} from "lucide-react"
import { startTransition, useEffect, useRef, useState } from "react"

const getContainerVariants = (motionEnabled: boolean) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: motionEnabled ? 0.1 : 0,
    },
  },
})

const getItemVariants = (motionEnabled: boolean) => ({
  hidden: { opacity: motionEnabled ? 0 : 1, y: motionEnabled ? 20 : 0 },
  visible: {
    opacity: 1,
    y: 0,
    transition: motionEnabled
      ? {
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1] as const,
        }
      : { duration: 0 },
  },
})

function ComplianceAlerts() {
  const alerts = [
    { days: 128, status: "green", doc: "House Rules" },
    { days: 54, status: "yellow", doc: "Employment Contract" },
    { days: 23, status: "orange", doc: "Safety Manual" },
  ]

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <div
            className={`h-2 w-2 rounded-full ${
              alert.status === "green"
                ? "bg-secondary"
                : alert.status === "yellow"
                  ? "bg-primary"
                  : "bg-accent"
            }`}
          />
          <span className="text-muted-foreground">{alert.doc}</span>
          <span className="ml-auto text-muted-foreground">{alert.days}d</span>
        </div>
      ))}
    </div>
  )
}

function BudgetChart({ motionEnabled }: { motionEnabled: boolean }) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) startTransition(() => setAnimated(true))
  }, [isInView])

  return (
    <div ref={ref} className="space-y-3">
      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
        <span>Budget vs Actual</span>
        <span>85%</span>
      </div>
      {[
        { label: "Materials", value: 75, color: "bg-primary" },
        { label: "Labor", value: 90, color: "bg-secondary" },
        { label: "Equipment", value: 60, color: "bg-accent" },
      ].map((item, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-muted-foreground">{item.value}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <motion.div
              className={`h-full ${item.color}`}
              initial={{ width: 0 }}
              animate={{ width: animated ? `${item.value}%` : 0 }}
              transition={motionEnabled ? { duration: 1, delay: i * 0.2 } : { duration: 0 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FeatureModules() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { motionEnabled } = useMotion()
  const containerVariants = getContainerVariants(motionEnabled)
  const itemVariants = getItemVariants(motionEnabled)

  return (
    <section id="features" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.6 } : { duration: 0 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Complete Governance Platform
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Eight integrated modules covering every aspect of estate management, from legally
            enforceable signatures to operational excellence.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 overflow-hidden rounded-2xl p-1"
        >
          <div className="vortex-glow opacity-30" />

          {/* Large card - Document Management */}
          <motion.div
            variants={itemVariants}
            className="ornate-border group relative rounded-2xl bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:from-card hover:to-muted/20 md:col-span-2"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-4 w-fit rounded-lg bg-primary/20 p-2">
                  <FileSignature className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  Document Management & E-Signatures
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  DocuSeal integration for BCEA-compliant e-signatures with cryptographic audit
                  trails. Full version control and multi-signatory workflows.
                </p>
                <div className="flex gap-2">
                  <span className="rounded bg-primary/20 px-2 py-1 text-xs text-primary">
                    18 Documents
                  </span>
                  <span className="rounded bg-primary/20 px-2 py-1 text-xs text-primary">
                    100% Compliant
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Financial Tracking */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-border/80 hover:from-card hover:to-muted/20"
          >
            <div className="mb-4 w-fit rounded-lg bg-secondary/20 p-2">
              <DollarSign className="h-5 w-5 text-secondary" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Financial Tracking</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Dual-mode expense management with contractor milestone payments and budget tracking.
            </p>
            <BudgetChart motionEnabled={motionEnabled} />
          </motion.div>

          {/* Compliance Alerts */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-border/80 hover:from-card hover:to-muted/20"
          >
            <div className="mb-4 w-fit rounded-lg bg-accent/20 p-2">
              <Bell className="h-5 w-5 text-accent" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Automated Compliance</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Multi-stage alerts (60d/30d/7d) for document expiry, leave accruals, and reviews.
            </p>
            <ComplianceAlerts />
          </motion.div>

          {/* Time Tracking */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-border/80 hover:from-card hover:to-muted/20"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <Clock className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Time Tracking</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              BCEA-compliant clock-in/out with automatic overtime calculation (&gt;9hrs/day).
            </p>
            <div className="text-sm">
              <div className="mb-1 flex justify-between text-muted-foreground">
                <span>This Week</span>
                <span className="text-secondary">42.5 hrs</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Overtime</span>
                <span className="text-accent">0.5 hrs</span>
              </div>
            </div>
          </motion.div>

          {/* Task Management */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-border/80 hover:from-card hover:to-muted/20"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <ClipboardList className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Task Management</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Daily and recurring task assignments with time logging and completion tracking.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 rounded bg-muted p-2 text-center">
                <div className="text-xl font-bold text-foreground">38</div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
              <div className="flex-1 rounded bg-muted p-2 text-center">
                <div className="text-xl font-bold text-primary">6</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </div>
          </motion.div>

          {/* Asset Registry */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-border/80 hover:from-card hover:to-muted/20"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Asset Registry</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Complete tracking of tools, vehicles, and equipment with maintenance schedules.
            </p>
            <div className="text-xs text-muted-foreground">6 assets • R434,400 total value</div>
          </motion.div>

          {/* Incident Reporting */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-border/80 hover:from-card hover:to-muted/20"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Incident Reporting</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Safety, equipment, and household incident tracking with automated routing.
            </p>
            <div className="flex gap-2 text-xs">
              <span className="rounded bg-accent/20 px-2 py-1 text-accent">0 High</span>
              <span className="rounded bg-primary/20 px-2 py-1 text-primary">1 Med</span>
              <span className="rounded bg-secondary/20 px-2 py-1 text-secondary">3 Low</span>
            </div>
          </motion.div>

          {/* Vehicle Logs */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-border/80 hover:from-card hover:to-muted/20"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <Car className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Vehicle Logs</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Usage authorization, fuel tracking, and child transport compliance.
            </p>
            <div className="text-sm text-muted-foreground">
              <div className="mb-1 flex justify-between">
                <span>Distance</span>
                <span className="text-foreground">171 km</span>
              </div>
              <div className="flex justify-between">
                <span>Fuel Cost</span>
                <span className="text-foreground">R1,237</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
