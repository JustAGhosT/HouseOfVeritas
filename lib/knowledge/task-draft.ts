import type { Task } from "@/lib/services/baserow"
import type { KnowledgeEntry } from "@/lib/knowledge/types"

/**
 * Turns curated knowledge into a proposed maintenance task.
 *
 * This returns a *draft* (Omit<Task, "id">) plus a checklist and safety
 * boundaries — it deliberately does NOT write to Baserow. Creation is gated on
 * human review: an operator confirms the draft, then the existing POST /api/tasks
 * flow persists it. That mirrors the requiresHumanReview posture of the guidance
 * analyze route and keeps safety-critical guidance from auto-committing work.
 */

export interface MaintenanceTaskDraft {
  task: Omit<Task, "id">
  checklist: string[]
  safety: string[]
  /** Provenance so a created task can be traced back to the knowledge entry. */
  knowledgeSlug: string
}

export interface TaskDraftContext {
  assignedToName?: string
  dueDate?: string
  project?: string
  relatedAsset?: number
  priority?: Task["priority"]
}

/** Safety-bearing troubleshooting should not be trivially low priority. */
function defaultPriority(entry: KnowledgeEntry): Task["priority"] {
  return entry.guidance.safety.length > 0 ? "High" : "Medium"
}

export function buildMaintenanceTaskDraft(
  entry: KnowledgeEntry,
  context: TaskDraftContext = {}
): MaintenanceTaskDraft {
  const checklist = entry.guidance.steps
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((step) => step.title)

  const descriptionLines = [
    entry.guidance.summary,
    "",
    `Source: knowledge/${entry.slug}`,
  ]

  return {
    task: {
      title: entry.guidance.title,
      description: descriptionLines.join("\n"),
      priority: context.priority ?? defaultPriority(entry),
      status: "Not Started",
      assignedToName: context.assignedToName,
      dueDate: context.dueDate,
      project: context.project,
      relatedAsset: context.relatedAsset,
    },
    checklist,
    safety: entry.guidance.safety,
    knowledgeSlug: entry.slug,
  }
}
