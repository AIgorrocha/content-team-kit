"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import type { BrandProfile } from "@/lib/types"

interface BrandProfileReviewProps {
  onComplete: () => void
}

interface EditableProfile {
  brand_voice: BrandProfile["brand_voice"]
  visual_identity: BrandProfile["visual_identity"]
  content_strategy: BrandProfile["content_strategy"]
  audience: BrandProfile["audience"]
}

function EditableList({
  label,
  items,
  onChange,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="hover:text-error"
              aria-label={`Remover ${item}`}
            >
              x
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => {
            const value = prompt("Adicionar item:")
            if (value?.trim()) {
              onChange([...items, value.trim()])
            }
          }}
          className="text-xs text-accent hover:underline"
        >
          + adicionar
        </button>
      </div>
    </div>
  )
}

export function BrandProfileReview({ onComplete }: BrandProfileReviewProps) {
  const [profile, setProfile] = useState<EditableProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-profile", { credentials: "include" })
      if (!res.ok) {
        setError("Erro ao carregar perfil")
        return
      }
      const data: BrandProfile = await res.json()
      setProfile({
        brand_voice: data.brand_voice,
        visual_identity: data.visual_identity,
        content_strategy: data.content_strategy,
        audience: data.audience,
      })
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  function updateVoice(field: string, value: unknown) {
    setProfile((prev) =>
      prev ? { ...prev, brand_voice: { ...prev.brand_voice, [field]: value } } : prev
    )
  }

  function updateVisual(field: string, value: unknown) {
    setProfile((prev) =>
      prev ? { ...prev, visual_identity: { ...prev.visual_identity, [field]: value } } : prev
    )
  }

  function updateStrategy(field: string, value: unknown) {
    setProfile((prev) =>
      prev ? { ...prev, content_strategy: { ...prev.content_strategy, [field]: value } } : prev
    )
  }

  function updateAudience(field: string, value: unknown) {
    setProfile((prev) =>
      prev ? { ...prev, audience: { ...prev.audience, [field]: value } } : prev
    )
  }

  async function handleSubmit() {
    if (!profile) return
    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/onboarding/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erro ao salvar revisão")
        return
      }

      onComplete()
    } catch {
      setError("Erro de conexão")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-12 text-center text-text-secondary">
          Carregando perfil...
        </CardContent>
      </Card>
    )
  }

  if (!profile) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-12 text-center text-error">
          {error || "Perfil não encontrado"}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Revise seu Perfil de Marca</h2>
        <p className="text-sm text-text-secondary">
          Gerado automaticamente. Ajuste o que quiser antes de continuar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voz da Marca</CardTitle>
          <CardDescription>Como sua marca se comunica</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Tom</label>
              <Input
                value={profile.brand_voice.tone}
                onChange={(e) => updateVoice("tone", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Energia</label>
              <Input
                value={profile.brand_voice.energy}
                onChange={(e) => updateVoice("energy", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">
              Formalidade (1-10)
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={profile.brand_voice.formality}
              onChange={(e) => updateVoice("formality", Number(e.target.value))}
            />
          </div>
          <EditableList
            label="Palavras favoritas"
            items={profile.brand_voice.favorite_words}
            onChange={(items) => updateVoice("favorite_words", items)}
          />
          <EditableList
            label="Palavras proibidas"
            items={profile.brand_voice.forbidden_words}
            onChange={(items) => updateVoice("forbidden_words", items)}
          />
          <EditableList
            label="Bordões"
            items={profile.brand_voice.catchphrases}
            onChange={(items) => updateVoice("catchphrases", items)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade Visual</CardTitle>
          <CardDescription>Cores e estilo da marca</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <EditableList
            label="Cores principais"
            items={profile.visual_identity.primary_colors}
            onChange={(items) => updateVisual("primary_colors", items)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Estilo de fonte</label>
              <Input
                value={profile.visual_identity.font_style}
                onChange={(e) => updateVisual("font_style", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Estilo de imagem</label>
              <Input
                value={profile.visual_identity.image_style}
                onChange={(e) => updateVisual("image_style", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estratégia de Conteúdo</CardTitle>
          <CardDescription>Plataformas e temas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <EditableList
            label="Plataformas"
            items={profile.content_strategy.platforms}
            onChange={(items) => updateStrategy("platforms", items)}
          />
          <EditableList
            label="Temas"
            items={profile.content_strategy.themes}
            onChange={(items) => updateStrategy("themes", items)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Público-Alvo</CardTitle>
          <CardDescription>Quem você quer alcançar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">Descrição</label>
            <Input
              value={profile.audience.description}
              onChange={(e) => updateAudience("description", e.target.value)}
            />
          </div>
          <EditableList
            label="Dores"
            items={profile.audience.pain_points}
            onChange={(items) => updateAudience("pain_points", items)}
          />
          <EditableList
            label="Objetivos"
            items={profile.audience.goals}
            onChange={(items) => updateAudience("goals", items)}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-error text-center">{error}</p>}

      <Button onClick={handleSubmit} className="w-full" disabled={saving}>
        {saving ? "Salvando..." : "Aprovar e Continuar"}
      </Button>
    </div>
  )
}
