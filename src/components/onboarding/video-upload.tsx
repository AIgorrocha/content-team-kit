"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface VideoUploadProps {
  onComplete: () => void
}

export function VideoUpload({ onComplete }: VideoUploadProps) {
  const [videoUrls, setVideoUrls] = useState<string[]>([""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function handleUrlChange(index: number, value: string) {
    setVideoUrls((prev) => prev.map((url, i) => (i === index ? value : url)))
  }

  function addField() {
    if (videoUrls.length >= 5) return
    setVideoUrls((prev) => [...prev, ""])
  }

  function removeField(index: number) {
    if (videoUrls.length <= 1) return
    setVideoUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const filled = videoUrls.filter((url) => url.trim() !== "")
    if (filled.length === 0) {
      setError("Adicione pelo menos um vídeo")
      return
    }

    setLoading(true)
    try {
      const uploadRes = await fetch("/api/onboarding/upload-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ video_urls: filled }),
      })

      if (!uploadRes.ok) {
        const data = await uploadRes.json()
        setError(data.error || "Erro ao enviar vídeos")
        return
      }

      const analyzeRes = await fetch("/api/onboarding/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })

      if (!analyzeRes.ok) {
        const data = await analyzeRes.json()
        setError(data.error || "Erro ao iniciar análise")
        return
      }

      onComplete()
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Seus Vídeos</CardTitle>
        <CardDescription>
          Cole links de 1 a 5 vídeos seus (YouTube ou link direto). Vamos transcrever e analisar seu jeito de falar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {videoUrls.map((url, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="url"
                placeholder={`Link do vídeo ${index + 1}`}
                value={url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
                className="flex-1"
              />
              {videoUrls.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeField(index)}
                  aria-label="Remover vídeo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              )}
            </div>
          ))}

          {videoUrls.length < 5 && (
            <Button type="button" variant="outline" onClick={addField} className="w-full">
              + Adicionar vídeo
            </Button>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar e Analisar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
