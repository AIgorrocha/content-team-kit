"use client"

import { cn } from "@/lib/utils"

const STEPS = [
  { key: "social_links", label: "Redes Sociais" },
  { key: "upload_videos", label: "Vídeos" },
  { key: "analyzing", label: "Análise" },
  { key: "review", label: "Revisão" },
  { key: "questionnaire", label: "Perguntas" },
  { key: "completed", label: "Concluído" },
] as const

interface StepIndicatorProps {
  currentStep: string
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center justify-center w-full max-w-2xl mx-auto py-6">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors",
                  isCompleted && "bg-accent border-accent text-white",
                  isCurrent && "border-accent text-accent bg-accent/10",
                  !isCompleted && !isCurrent && "border-border text-text-secondary bg-surface"
                )}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1.5 whitespace-nowrap",
                  isCurrent ? "text-accent font-medium" : "text-text-secondary"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 sm:w-12 h-0.5 mx-1 mt-[-1rem]",
                  index < currentIndex ? "bg-accent" : "bg-border"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
