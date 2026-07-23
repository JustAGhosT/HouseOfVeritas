import DashboardLayout from "@/components/dashboard-layout"
import { InventoryBatchCapturePreview } from "@/components/inventory-batch-capture-preview"
import { InventoryPhotoCapture } from "@/components/inventory-photo-capture"
import { ScopedInventoryList } from "@/components/scoped-inventory-list"
import { Boxes } from "lucide-react"
import { notFound } from "next/navigation"

const PERSONA_CONFIG = {
  hans: {
    tone: "blue",
    category: "other",
    location: "House",
    title: "Inventory",
    description: "Capture and label inventory photos.",
  },
  charl: {
    tone: "amber",
    category: "workshop_consumables",
    location: "Workshop Store",
    title: "Workshop Inventory",
    description: "Take a photo, add a label, and save the item.",
  },
  lucky: {
    tone: "green",
    category: "garden_supplies",
    location: "Yard",
    title: "Garden Inventory",
    description: "Capture supplies from the yard or garden store.",
  },
  irma: {
    tone: "purple",
    category: "household",
    location: "House",
    title: "Household Inventory",
    description: "Photograph and label household items.",
  },
} as const

type Persona = keyof typeof PERSONA_CONFIG

function isPersona(value: string): value is Persona {
  return value in PERSONA_CONFIG
}

interface UniversalInventoryPageProps {
  params: Promise<{ persona: string }>
}

export default async function UniversalInventoryPage({ params }: UniversalInventoryPageProps) {
  const { persona } = await params
  const personaParam = persona.toLowerCase()

  if (!isPersona(personaParam)) {
    notFound()
  }

  const config = PERSONA_CONFIG[personaParam]

  return (
    <DashboardLayout persona={personaParam}>
      <div className="relative z-10 space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
            <Boxes className="h-8 w-8 text-white/80" />
            {config.title}
          </h1>
          <p className="mt-1 text-white/60">{config.description}</p>
        </div>

        <InventoryPhotoCapture
          persona={personaParam}
          tone={config.tone}
          defaultCategory={config.category}
          defaultLocation={config.location}
        />

        <InventoryBatchCapturePreview defaultLocation={config.location} />

        <ScopedInventoryList />
      </div>
    </DashboardLayout>
  )
}
