"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface AnalysisProgressProps {
  onComplete: () => void
}

const MESSAGES = [
  "Analisando redes sociais...",
  "Analisando site...",
  "Transcrevendo vídeos...",
  "Gerando perfil da marca...",
]

export function AnalysisProgress({ onComplete }: AnalysisProgressProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/status", {
        credentials: "include",
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.step && data.step !== "analyzing") {
        onCompleteRef.current()
      }
    } catch {
      // silently retry on next interval
    }
  }, [])

  useEffect(() => {
    const pollInterval = setInterval(pollStatus, 4000)
    return () => clearInterval(pollInterval)
  }, [pollStatus])

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length)
    }, 5000)
    return () => clearInterval(msgInterval)
  }, [])

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Analisando seu conteúdo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 py-8">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-border" />
          <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>

        <p className="text-sm text-text-secondary animate-pulse">
          {MESSAGES[messageIndex]}
        </p>

        <p className="text-xs text-text-secondary text-center max-w-xs">
          Isso pode levar alguns minutos. Você pode esperar aqui ou voltar depois — continuaremos de onde parou.
        </p>
      </CardContent>
    </Card>
  )
}
