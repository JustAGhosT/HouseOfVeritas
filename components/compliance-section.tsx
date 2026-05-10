"use client"

import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import { Activity, Clock, Database, FileCheck, Lock, Shield, Server } from "lucide-react"
import { useRef } from "react"

const trustIndicators = [
  {
    icon: FileCheck,
    title: "BCEA Compliant",
    description: "Employment records meet Basic Conditions of Employment Act requirements",
  },
  {
    icon: Shield,
    title: "POPIA Compliant",
    description: "Data protection standards aligned with Protection of Personal Information Act",
  },
  {
    icon: Lock,
    title: "ECT Act Signatures",
    description: "Digital signatures comply with Electronic Communications and Transactions Act",
  },
  {
    icon: Database,
    title: "Full Audit Trail",
    description: "Complete version control and audit logs for all actions and documents",
  },
  {
    icon: Activity,
    title: "99.9% Uptime SLA",
    description: "Azure-backed infrastructure with enterprise-grade reliability",
  },
  {
    icon: Clock,
    title: "4-Hour Recovery",
    description: "Documented disaster recovery procedures with <4hr RTO",
  },
]

export function ComplianceSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { motionEnabled } = useMotion()

  return (
    <section id="compliance" className="bg-background px-4 py-24">
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
            Bank-Grade Security & Compliance
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Built from the ground up to handle sensitive estate data, with enterprise-grade encryption
            and full BCEA compliance for all employee and contractor operations.
          </p>
        </motion.div>

        <div ref={ref} className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {trustIndicators.map((indicator, index) => {
            const Icon = indicator.icon
            return (
              <motion.div
                key={indicator.title}
                initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={motionEnabled ? { duration: 0.6, delay: index * 0.1 } : { duration: 0 }}
                className="group ornate-border overflow-hidden rounded-2xl bg-card p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10"
              >
                {/* Inner Glow Polish */}
                <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                
                <div className="relative z-10">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="rounded-xl bg-secondary/15 p-3 shadow-inner">
                      <Icon className="h-6 w-6 text-secondary" strokeWidth={1.5} />
                    </div>
                    <Shield className="h-5 w-5 text-primary/30 transition-colors group-hover:text-primary/60" strokeWidth={1.5} />
                  </div>
                  <h3 className="mb-3 font-serif text-xl font-bold text-foreground tracking-tight">
                    {indicator.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground/90 italic font-medium">
                    {indicator.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Additional Security Info */}
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.6, delay: 0.6 } : { duration: 0 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-8" // Replaced original classes with new structure
        >
          <div className="flex items-center gap-2 opacity-50 transition-opacity hover:opacity-100">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Encryption at Rest</div>
          </div>
          <div className="flex items-center gap-2 opacity-50 transition-opacity hover:opacity-100">
            <Server className="h-6 w-6 text-muted-foreground" /> {/* Changed from Database to Server */}
            <div className="text-sm text-muted-foreground">In-Transit Security</div>
          </div>
          <div className="flex items-center gap-2 opacity-50 transition-opacity hover:opacity-100">
            <Database className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Enterprise Infrastructure</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
