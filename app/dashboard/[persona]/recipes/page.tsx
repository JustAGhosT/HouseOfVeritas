import { notFound } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import RecipeCatalogClient from "@/components/recipes/recipe-catalog-client"

const PERSONAS = ["hans", "charl", "lucky", "irma"] as const

type Persona = (typeof PERSONAS)[number]

function isPersona(value: string): value is Persona {
  return PERSONAS.includes(value as Persona)
}

export default async function RecipeDashboardPage({
  params,
}: {
  params: Promise<{ persona: string }>
}) {
  const { persona } = await params
  const normalizedPersona = persona.toLowerCase()

  if (!isPersona(normalizedPersona)) notFound()

  return (
    <DashboardLayout persona={normalizedPersona}>
      <RecipeCatalogClient persona={normalizedPersona} />
    </DashboardLayout>
  )
}
