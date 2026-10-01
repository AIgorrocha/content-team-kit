"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface SocialLinksFormProps {
  onComplete: () => void
}

const SOCIAL_FIELDS = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/seuperfil" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@seucanal" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@seuperfil" },
  { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/seuperfil" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/seuperfil" },
] as const

export function SocialLinksForm({ onComplete }: SocialLinksFormProps) {
  const [links, setLinks] = useState<Record<string, string>>({})
  const [siteUrl, setSiteUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function handleLinkChange(key: string, value: string) {
    setLinks((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const filledLinks = Object.fromEntries(
      Object.entries(links).filter(([, v]) => v.trim() !== "")
    )

    if (Object.keys(filledLinks).length === 0) {
      setError("Preencha pelo menos uma rede social")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/onboarding/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          social_links: filledLinks,
          ...(siteUrl.trim() ? { site_url: siteUrl.trim() } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erro ao salvar redes sociais")
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
        <CardTitle>Suas Redes Sociais</CardTitle>
        <CardDescription>
          Cole os links dos seus perfis. Vamos analisar seu conteúdo para entender seu estilo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {SOCIAL_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="text-sm font-medium">{field.label}</label>
              <Input
                type="url"
                placeholder={field.placeholder}
                value={links[field.key] || ""}
                onChange={(e) => handleLinkChange(field.key, e.target.value)}
              />
            </div>
          ))}

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Site / Blog <span className="text-text-secondary font-normal">(opcional)</span>
            </label>
            <Input
              type="url"
              placeholder="https://seusite.com.br"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Continuar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
