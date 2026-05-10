"use client"

import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import { Home, Shield, Sprout, Wrench } from "lucide-react"
import { useRef, useMemo } from "react"
import { generateIdentityBadge } from "@/lib/design/badges"
import { IdentityBadgeCard } from "@/components/ui/identity-badge"
import Image from "next/image"

const roles = [
  {
    name: "Hans",
    title: "Owner/Administrator",
    icon: Shield,
    color: "primary",
    features: [
      "Complete oversight dashboard",
      "Approval workflows",
      "Financial tracking",
      "Compliance monitoring",
      "User management",
    ],
  },
  {
    name: "Charl",
    title: "Workshop Operator",
    icon: Wrench,
    color: "secondary",
    features: [
      "My tasks dashboard",
      "Asset management",
      "Time logging",
      "Incident reporting",
      "Workshop tools access",
    ],
  },
  {
    name: "Lucky",
    title: "Gardener/Handyman",
    icon: Sprout,
    color: "accent",
    features: [
      "Daily task list",
      "Expense submission",
      "Time tracking",
      "Vehicle logs",
      "Garden equipment access",
    ],
  },
  {
    name: "Irma",
    title: "Resident/Household",
    icon: Home,
    color: "muted",
    features: [
      "Household tasks",
      "Resident agreement",
      "Incident reporting",
      "Child-related logs",
      "Simplified interface",
    ],
  },
]

const colorClasses: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  primary: {
    bg: "bg-card",
    border: "border-border hover:border-primary/50",
    text: "text-primary",
    icon: "bg-primary/20",
  },
  secondary: {
    bg: "bg-card",
    border: "border-border hover:border-secondary/50",
    text: "text-secondary",
    icon: "bg-secondary/20",
  },
  accent: {
    bg: "bg-card",
    border: "border-border hover:border-accent/50",
    text: "text-accent",
    icon: "bg-accent/20",
  },
  muted: {
    bg: "bg-card",
    border: "border-border hover:border-foreground/50",
    text: "text-foreground",
    icon: "bg-muted",
  },
}

export function RoleDashboards() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { motionEnabled } = useMotion()

  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.6 } : { duration: 0 }}
          className="mb-16 text-center"
        >
          <h2
            className="font-serif mb-4 text-3xl font-bold text-foreground sm:text-4xl"
          >
            Role-Based Access Control
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Each user sees only what&apos;s relevant to their role. Granular permissions ensure
            security while maintaining ease of use.
          </p>
        </motion.div>

        <div ref={ref} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {roles.map((role, index) => {
            const Icon = role.icon
            const colors = colorClasses[role.color]

            // We use useMemo inside a mapped array which breaks Rules of Hooks
            // Instead, generate badges outside or use a deterministic approach.
            // Since this is a demo showcase, we generate them once on render.
            // A better way is mapping roles to badges beforehand.
            
            return (
              <RoleCard 
                key={role.name}
                role={role}
                colors={colors}
                index={index}
                motionEnabled={motionEnabled}
                isInView={isInView}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

function RoleCard({ role, colors, index, motionEnabled, isInView }: any) {
  // Generate a badge for this specific role card display
  const badge = useMemo(() => generateIdentityBadge(role.name), [role.name])
  const Icon = role.icon

  return (
    <motion.div
      initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={motionEnabled ? { duration: 0.6, delay: index * 0.1 } : { duration: 0 }}
      className={`group relative overflow-hidden rounded-xl border p-6 ${colors.bg} ${colors.border} shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-primary/5`}
    >
      {/* Visual Depth Polish */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.03] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.07]">
        <Image src="/hv-logo-small.svg" alt="" width={96} height={96} className="rotate-12 grayscale invert" />
      </div>

      <div className="mb-6 flex justify-center">
        <div className="scale-75 origin-top w-full flex justify-center drop-shadow-2xl">
          <IdentityBadgeCard badge={badge} />
        </div>
      </div>
      
      <div className="relative z-10">
        <div className={`rounded-lg p-3 ${colors.icon} mb-4 w-fit shadow-inner`}>
          <Icon className={`h-6 w-6 ${colors.text}`} strokeWidth={1.5} />
        </div>
        <h3 className="mb-1 font-serif text-xl font-bold text-foreground tracking-tight">
          {role.name}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground italic font-medium">{role.title}</p>
        
        <ul className="space-y-2.5">
          {role.features.map((feature: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground/90 leading-relaxed transition-colors group-hover:text-foreground">
              <span
                className={`mt-1.5 h-1 w-1 rounded-full ${colors.text.replace("text", "bg")} shrink-0 shadow-sm`}
              />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
