"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { SocialLinksForm } from "@/components/onboarding/social-links-form"
import { VideoUpload } from "@/components/onboarding/video-upload"
import { AnalysisProgress } from "@/components/onboarding/analysis-progress"
import { BrandProfileReview } from "@/components/onboarding/brand-profile-review"
import { AgentQuestions } from "@/components/onboarding/agent-questions"
import type { OnboardingStep } from "@/lib/types"

export default function OnboardingPage() {
  const [brandStep, setBrandStep] = useState<OnboardingStep>("social_links")

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
        setBrandStep(data.step as OnboardingStep)
      }
    } catch {
      // sem status ainda: começa pelo primeiro passo
    } finally {
      setInitialLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

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
