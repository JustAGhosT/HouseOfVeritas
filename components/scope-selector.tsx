"use client"

import { useEffect, useState } from "react"
import { MapPinned } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetchSafe } from "@/lib/api-client"
import type { Project } from "@/lib/projects"

const STORAGE_KEY = "hov:selected-scope-id"
const ALL_SCOPES = "_all"

export function getStoredScopeId(): string {
  if (typeof window === "undefined") return ALL_SCOPES
  return window.localStorage.getItem(STORAGE_KEY) || ALL_SCOPES
}

export function ScopeSelector() {
  const [scopes, setScopes] = useState<Project[]>([])
  const [selectedScopeId, setSelectedScopeId] = useState(getStoredScopeId)

  useEffect(() => {
    apiFetchSafe<{ projects?: Project[] }>(
      "/api/projects?type=major",
      { projects: [] },
      { label: "Scopes" }
    ).then((data) => {
      const loaded = data?.projects || []
      setScopes(loaded)
      if (typeof window === "undefined") return

      const stored = getStoredScopeId()
      if (stored !== ALL_SCOPES && !loaded.some((scope) => scope.id === stored)) {
        window.localStorage.setItem(STORAGE_KEY, ALL_SCOPES)
        setSelectedScopeId(ALL_SCOPES)
      }
    })
  }, [])

  if (scopes.length === 0) return null

  const handleChange = (value: string) => {
    setSelectedScopeId(value)
    window.localStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new CustomEvent("hov:scope-change", { detail: { scopeId: value } }))
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <MapPinned className="h-3.5 w-3.5" />
        Scope
      </span>
      <Select value={selectedScopeId} onValueChange={handleChange}>
        <SelectTrigger className="h-9 w-48 border-border bg-card/80 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SCOPES}>All scopes</SelectItem>
          {scopes.map((scope) => (
            <SelectItem key={scope.id} value={scope.id}>
              {scope.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
