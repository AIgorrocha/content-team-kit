"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface AgentQuestionsProps {
  onComplete: () => void
}

interface Question {
  id: string
  text: string
  type: "text" | "select" | "multiselect" | "scale"
  options?: string[]
  min?: number
  max?: number
}

function ScaleInput({
  value,
  min,
  max,
  onChange,
}: {
  value: string
  min: number
  max: number
  onChange: (v: string) => void
}) {
  const current = Number(value) || min

  return (
    <div className="space-y-2">
      <input
        type="range"
        min={min}
        max={max}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-accent"
      />
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{min}</span>
        <span className="font-medium text-text-primary">{current}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

function MultiselectInput({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            selected.includes(opt)
              ? "bg-accent text-white border-accent"
              : "bg-surface border-border text-text-secondary hover:border-accent"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function AgentQuestions({ onComplete }: AgentQuestionsProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-profile", { credentials: "include" })
      if (!res.ok) {
        setError("Erro ao carregar perguntas")
        return
      }
      const data = await res.json()
      const raw = data.raw_social_data?.questions as Question[] | undefined
      setQuestions(raw || [])
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  function updateAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/onboarding/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answers }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erro ao enviar respostas")
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
      <Card className="w-full max-w-lg mx-auto">
        <CardContent className="py-12 text-center text-text-secondary">
          Carregando perguntas...
        </CardContent>
      </Card>
    )
  }

  if (questions.length === 0) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-text-secondary">Nenhuma pergunta adicional necessária.</p>
          <Button onClick={onComplete}>Continuar</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Perguntas Complementares</CardTitle>
        <CardDescription>
          Responda para refinar ainda mais o perfil da sua marca.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <label className="text-sm font-medium">{q.text}</label>

              {q.type === "text" && (
                <Input
                  value={answers[q.id] || ""}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  placeholder="Sua resposta..."
                />
              )}

              {q.type === "select" && q.options && (
                <Select
                  value={answers[q.id] || ""}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {q.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              )}

              {q.type === "multiselect" && q.options && (
                <MultiselectInput
                  options={q.options}
                  selected={(answers[q.id] || "").split(",").filter(Boolean)}
                  onChange={(items) => updateAnswer(q.id, items.join(","))}
                />
              )}

              {q.type === "scale" && (
                <ScaleInput
                  value={answers[q.id] || String(q.min ?? 1)}
                  min={q.min ?? 1}
                  max={q.max ?? 10}
                  onChange={(v) => updateAnswer(q.id, v)}
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Enviando..." : "Finalizar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
