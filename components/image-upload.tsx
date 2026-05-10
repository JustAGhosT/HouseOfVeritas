"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, X, Loader2, ImageIcon, CheckCircle } from "lucide-react"
import Image from "next/image"
import { apiFetch } from "@/lib/api-client"

interface ImageUploadProps {
  onUpload: (files: UploadedFile[]) => void
  category?: string
  assetId?: string
  maxFiles?: number
  existingImages?: string[]
}

interface UploadedFile {
  id: string
  url: string
  filename: string
  storage: string
}

export function ImageUpload({
  onUpload,
  category = "asset-photos",
  assetId,
  maxFiles = 5,
  existingImages = [],
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [preview, setPreview] = useState<string[]>([...existingImages])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      // Validate total count
      if (preview.length + files.length > maxFiles) {
        setError(`Maximum ${maxFiles} images allowed`)
        return
      }

      setUploading(true)
      setError(null)

      const newPreviews: string[] = []
      const newUploads: UploadedFile[] = []

      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          setError("Only image files allowed")
          continue
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError("File too large (max 5MB)")
          continue
        }

        // Create preview immediately
        const reader = new FileReader()
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string)
          setPreview((prev) => [...prev, e.target?.result as string])
        }
        reader.readAsDataURL(file)

        // Upload to server
        try {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("category", category)
          if (assetId) formData.append("assetId", assetId)

          const data = await apiFetch<{ success?: boolean; file?: UploadedFile; error?: string }>(
            "/api/files",
            {
              method: "POST",
              body: formData,
              label: "UploadFile",
            }
          )
          if (data?.success && data?.file) {
            newUploads.push(data.file)
          } else {
            setError(data?.error || "Upload failed")
          }
        } catch (err: any) {
          setError(err.message || "Upload failed")
        }
      }

      setUploadedFiles((prev) => [...prev, ...newUploads])
      onUpload([...uploadedFiles, ...newUploads])
      setUploading(false)

      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [preview.length, maxFiles, category, assetId, uploadedFiles, onUpload]
  )

  const removeImage = (index: number) => {
    const newPreviews = [...preview]
    newPreviews.splice(index, 1)
    setPreview(newPreviews)

    const newUploads = [...uploadedFiles]
    if (index < uploadedFiles.length) {
      // TODO: Delete from server
      newUploads.splice(index, 1)
      setUploadedFiles(newUploads)
      onUpload(newUploads)
    }
  }

  return (
    <div className="space-y-4">
      {/* Preview Grid */}
      {preview.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {preview.map((src, idx) => (
            <div key={idx} className="group relative aspect-square">
              <Image
                src={src}
                alt={`Upload ${idx + 1}`}
                fill
                className="rounded-lg border border-white/10 object-cover"
                unoptimized
              />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3 text-white" />
              </button>
              {idx < uploadedFiles.length && (
                <div className="absolute right-1 bottom-1 rounded-full bg-primary/80 p-1">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone */}
      {preview.length < maxFiles && (
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            disabled={uploading}
            data-testid="image-upload-input"
          />
          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              uploading
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-border/80"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-white/60">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="mb-2 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-white/40" />
                  <ImageIcon className="h-5 w-5 text-white/40" />
                </div>
                <p className="text-sm text-white/60">Drop images here or click to upload</p>
                <p className="mt-1 text-xs text-white/40">
                  {maxFiles - preview.length} more images allowed (max 5MB each)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
