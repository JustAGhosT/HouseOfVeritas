"use client"

import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import { Activity, BarChart3, Command, Shield, Zap } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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

function SystemStatus({ motionEnabled }: { motionEnabled: boolean }) {
  const [dots, setDots] = useState([true, true, true, false, true])

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => prev.map(() => Math.random() > 0.2))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2">
      {dots.map((active, i) => (
        <motion.div
          key={i}
          className={`h-2 w-2 rounded-full ${active ? "bg-primary" : "bg-muted"}`}
          animate={active && motionEnabled ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={
            motionEnabled
              ? { duration: 1, repeat: Number.POSITIVE_INFINITY, delay: i * 0.2 }
              : { duration: 0 }
          }
        />
      ))}
    </div>
  )
}

function KeyboardCommand({ motionEnabled }: { motionEnabled: boolean }) {
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setPressed(true)
      setTimeout(() => setPressed(false), 200)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-1">
      <motion.kbd
        animate={pressed && motionEnabled ? { scale: 0.95, y: 2 } : { scale: 1, y: 0 }}
        transition={motionEnabled ? { duration: 0.1 } : { duration: 0 }}
        className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
      >
        ⌘
      </motion.kbd>
      <motion.kbd
        animate={pressed && motionEnabled ? { scale: 0.95, y: 2 } : { scale: 1, y: 0 }}
        transition={motionEnabled ? { delay: 0.05, duration: 0.1 } : { duration: 0 }}
        className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
      >
        K
      </motion.kbd>
    </div>
  )
}

function AnimatedChart() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const points = [
    { x: 0, y: 60 },
    { x: 20, y: 45 },
    { x: 40, y: 55 },
    { x: 60, y: 30 },
    { x: 80, y: 40 },
    { x: 100, y: 15 },
  ]

  const pathD = points.reduce((acc, point, i) => {
    return i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`
  }, "")

  return (
    <svg ref={ref} viewBox="0 0 100 70" className="h-24 w-full">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(255,255,255)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(255,255,255)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {isInView && (
        <>
          <path
            d={`${pathD} L 100 70 L 0 70 Z`}
            fill="url(#chartGradient)"
            className="opacity-50"
          />
          <path
            d={pathD}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            className="draw-line"
          />
        </>
      )}
    </svg>
  )
}

export function BentoGrid() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { motionEnabled } = useMotion()
  const containerVariants = getContainerVariants(motionEnabled)
  const itemVariants = getItemVariants(motionEnabled)

  const [metricValues] = useState(() =>
    ["CPU", "Memory", "Network", "Storage"].map((name) => ({
      name,
      value: Math.floor(Math.random() * 40 + 60),
    }))
  )

  return (
    <section id="features" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.6 } : { duration: 0 }}
          className="mb-16 text-center"
        >
          <h2
            className="mb-4 text-3xl font-bold font-serif text-foreground sm:text-4xl"
          >
            Everything you need to ship
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Built for modern teams. Powerful features that help you build, deploy, and scale faster
            than ever.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {/* Large card - System Status */}
          <motion.div
            variants={itemVariants}
            className="group relative overflow-hidden rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 md:col-span-2"
          >
            <div className="mb-8 flex items-start justify-between">
              <div>
                <div className="mb-4 w-fit rounded-lg bg-muted p-2">
                  <Activity className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Real-time Monitoring</h3>
                <p className="text-sm text-muted-foreground">
                  Track system health, performance metrics, and alerts in real-time across all your
                  deployments.
                </p>
              </div>
              <SystemStatus motionEnabled={motionEnabled} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {metricValues.map(({ name, value }) => (
                <div key={name} className="text-center">
                  <div className="mb-1 text-2xl font-bold text-foreground">{value}%</div>
                  <div className="text-xs text-muted-foreground">{name}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Command Palette */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <Command className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Command Palette</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Navigate anywhere instantly with powerful keyboard shortcuts.
            </p>
            <KeyboardCommand motionEnabled={motionEnabled} />
          </motion.div>

          {/* Analytics */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Analytics</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Deep insights into your application performance.
            </p>
            <AnimatedChart />
          </motion.div>

          {/* Performance */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <Zap className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Blazing Fast</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Edge-optimized infrastructure for sub-50ms response times globally.
            </p>
            <div className="flex items-center gap-2 text-sm text-primary">
              <span className="font-mono">~32ms</span>
              <span className="text-muted-foreground">avg response</span>
            </div>
          </motion.div>

          {/* Security */}
          <motion.div
            variants={itemVariants}
            className="group relative rounded-2xl border border-border bg-linear-to-b from-card to-background p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50"
          >
            <div className="mb-4 w-fit rounded-lg bg-muted p-2">
              <Shield className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Enterprise Security</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              SOC2 compliant with end-to-end encryption and SSO support.
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">SOC2</span>
              <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">GDPR</span>
              <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">HIPAA</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
