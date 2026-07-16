import DashboardLayout from "@/components/dashboard-layout"
import { JobDetailPageContent } from "@/components/job-detail-page-content"
import { notFound } from "next/navigation"

const PERSONAS = ["hans", "charl", "lucky", "irma"] as const

type Persona = (typeof PERSONAS)[number]

function isPersona(value: string): value is Persona {
  return PERSONAS.includes(value as Persona)
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ persona: string; id: string }>
}) {
  const { persona, id } = await params

  if (!isPersona(persona)) notFound()

  return (
    <DashboardLayout persona={persona}>
      <JobDetailPageContent persona={persona} projectId={id} />
    </DashboardLayout>
  )
}