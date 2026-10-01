"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { SocialLinksForm } from "@/components/onboarding/social-links-form"
import { VideoUpload } from "@/components/onboarding/video-upload"
import { AnalysisProgress } from "@/components/onboarding/analysis-progress"
import { BrandProfileReview } from "@/components/onboarding/brand-profile-review"
import { AgentQuestions } from "@/components/onboarding/agent-questions"
import type { OnboardingStep } from "@/lib/types"

type Phase = "setup" | "brand"

export default function OnboardingPage() {
  const [phase, setPhase] = useState<Phase>("setup")
  const [brandStep, setBrandStep] = useState<OnboardingStep>("social_links")

  const [workspaceName, setWorkspaceName] = useState("")
  const [databaseUrl, setDatabaseUrl] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const router = useRouter()

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/status", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()

      if (data.onboarding_completed) {
        router.push("/")
        router.refresh()
        return
      }

      if (data.step) {
        setPhase("brand")
        setBrandStep(data.step as OnboardingStep)
      }
    } catch {
      // workspace not set up yet, stay on setup phase
    } finally {
      setInitialLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workspace_name: workspaceName,
          database_url: databaseUrl,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        handleSetupComplete()
      } else {
        setError(data.error || "Erro ao criar workspace")
      }
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  function handleSetupComplete() {
    setPhase("brand")
    setBrandStep("social_links")
  }

  function advanceBrandStep() {
    const order: OnboardingStep[] = [
      "social_links",
      "upload_videos",
      "analyzing",
      "review",
      "questionnaire",
      "completed",
    ]
    const currentIndex = order.indexOf(brandStep)
    const nextStep = order[currentIndex + 1]

    if (nextStep === "completed") {
      router.push("/")
      router.refresh()
      return
    }

    if (nextStep) {
      setBrandStep(nextStep)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-text-secondary">Carregando...</p>
      </div>
    )
  }

  // --- SETUP PHASE ---
  if (phase === "setup") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Configurar Workspace</CardTitle>
            <CardDescription>
              Conecte seu banco de dados Supabase para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Workspace</label>
                <Input
                  type="text"
                  placeholder="Ex: Minha Empresa"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">URL do Banco de Dados</label>
                <Input
                  type="text"
                  placeholder="postgresql://postgres:senha@host:5432/postgres"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Encontre no Supabase: Settings → Database → Connection string (URI)
                </p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Conectando..." : "Conectar e Criar Workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- BRAND PROFILE PHASE ---
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <StepIndicator currentStep={brandStep} />

        <div className="mt-8">
          {brandStep === "social_links" && (
            <SocialLinksForm onComplete={advanceBrandStep} />
          )}
          {brandStep === "upload_videos" && (
            <VideoUpload onComplete={advanceBrandStep} />
          )}
          {brandStep === "analyzing" && (
            <AnalysisProgress onComplete={advanceBrandStep} />
          )}
          {brandStep === "review" && (
            <BrandProfileReview onComplete={advanceBrandStep} />
          )}
          {brandStep === "questionnaire" && (
            <AgentQuestions onComplete={advanceBrandStep} />
          )}
        </div>
      </div>
    </div>
  )
}
