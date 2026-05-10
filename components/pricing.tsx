"use client"

import { Button } from "@/components/ui/button"
import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { useRef, useState } from "react"

const plans = [
  {
    name: "Starter",
    description: "Perfect for side projects and small teams",
    price: { monthly: 0, yearly: 0 },
    features: [
      "3 team members",
      "10 projects",
      "Basic analytics",
      "Community support",
      "1GB storage",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    description: "For growing teams that need more power",
    price: { monthly: 29, yearly: 24 },
    features: [
      "Unlimited team members",
      "Unlimited projects",
      "Advanced analytics",
      "Priority support",
      "100GB storage",
      "Custom domains",
      "API access",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "For organizations with advanced needs",
    price: { monthly: 99, yearly: 79 },
    features: [
      "Everything in Pro",
      "SSO & SAML",
      "Dedicated support",
      "SLA guarantee",
      "Unlimited storage",
      "Custom integrations",
      "Audit logs",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
]

function BorderBeam() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <div
        className="border-beam absolute h-24 w-24 bg-white/20 blur-xl"
        style={{
          offsetPath: "rect(0 100% 100% 0 round 16px)",
        }}
      />
    </div>
  )
}

export default function PricingSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const { motionEnabled } = useMotion()
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")

  return (
    <section id="pricing" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.6 } : { duration: 0 }}
          className="mb-12 text-center"
        >
          <h2
            className="mb-4 text-3xl font-bold text-white sm:text-4xl"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-zinc-400">
            Start free, scale as you grow. No hidden fees, no surprises.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center rounded-full border border-border bg-muted p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === "monthly" ? "text-white" : "text-zinc-400"
              }`}
            >
              {billingCycle === "monthly" && (
                <motion.div
                  layoutId={motionEnabled ? "billing-toggle" : undefined}
                  className="absolute inset-0 rounded-full bg-zinc-800"
                  transition={
                    motionEnabled
                      ? { type: "spring", stiffness: 500, damping: 30 }
                      : { duration: 0 }
                  }
                />
              )}
              <span className="relative z-10">Monthly</span>
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {billingCycle === "yearly" && (
                <motion.div
                  layoutId={motionEnabled ? "billing-toggle" : undefined}
                  className="absolute inset-0 rounded-full bg-card shadow-sm border border-border"
                  transition={
                    motionEnabled
                      ? { type: "spring", stiffness: 500, damping: 30 }
                      : { duration: 0 }
                  }
                />
              )}
              <span className="relative z-10">Yearly</span>
              <span className="relative z-10 ml-2 rounded-full border border-secondary/50 bg-secondary/20 px-2 py-0.5 text-xs text-secondary">
                -20%
              </span>
            </button>
          </div>
        </motion.div>

        <motion.div
          ref={ref}
          initial={motionEnabled ? { opacity: 0, y: 40 } : { opacity: 1, y: 0 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.6, delay: 0.2 } : { duration: 0 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={
                motionEnabled ? { duration: 0.6, delay: 0.3 + index * 0.1 } : { duration: 0 }
              }
              className={`relative rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02] ${
                plan.highlighted
                  ? "border-primary bg-background shadow-lg shadow-primary/10"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              {plan.highlighted && <BorderBeam />}

              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-950">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="mb-2 text-xl font-semibold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">${plan.price[billingCycle]}</span>
                  {plan.price.monthly > 0 && <span className="text-sm text-muted-foreground">/month</span>}
                </div>
                {billingCycle === "yearly" && plan.price.yearly > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Billed annually (${plan.price.yearly * 12}/year)
                  </p>
                )}
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-foreground/80">
                    <Check className="h-4 w-4 shrink-0 text-secondary" strokeWidth={1.5} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full rounded-full ${
                  plan.highlighted
                    ? "shimmer-btn bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border bg-muted text-foreground hover:bg-muted/80"
                }`}
                onClick={() => {
                  if (plan.name === "Starter") {
                    router.push("/signup?plan=starter")
                  } else if (plan.name === "Pro") {
                    router.push("/signup?plan=pro")
                  } else if (plan.name === "Enterprise") {
                    router.push("/contact-sales?plan=enterprise")
                  }
                }}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
