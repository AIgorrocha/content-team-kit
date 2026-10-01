"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

const MDEditor = dynamic(() => import("@uiw/react-md-editor").then((mod) => mod.default), { ssr: false })

interface EditorPromptProps {
  value: string
  onChange: (valor: string) => void
  disabled?: boolean
}

const LARGURA_QUEBRA = 768 // < 768px: preview lado a lado não cabe, vira alternância manual.

// Editor Markdown com preview lado a lado (preview="live") acima de 768px. Abaixo disso o
// preview lado a lado espremia o textarea numa coluna estreita demais pra editar (Tarefa 13):
// o editor abre em modo "edit" com um botão "Prévia" que alterna pra "preview" sem lado a lado.
// Mantém o frontmatter intacto porque edita a string inteira do prompt, sem parsear nem
// remontar nada.
export function EditorPrompt({ value, onChange, disabled }: EditorPromptProps) {
  const [modoCor, setModoCor] = useState<"light" | "dark">("dark")
  const [mobile, setMobile] = useState(false)
  const [mostrarPreview, setMostrarPreview] = useState(false)

  useEffect(() => {
    // A Sala não tem alternância de tema hoje (dashboard sempre escuro); segue a
    // classe do documento se um dia existir, com "dark" como padrão.
    setModoCor(document.documentElement.classList.contains("light") ? "light" : "dark")
  }, [])

  useEffect(() => {
    const checar = () => setMobile(window.innerWidth < LARGURA_QUEBRA)
    checar()
    window.addEventListener("resize", checar)
    return () => window.removeEventListener("resize", checar)
  }, [])

  const preview = mobile ? (mostrarPreview ? "preview" : "edit") : "live"

  return (
    <div data-color-mode={modoCor} className="flex flex-col gap-2">
      {mobile && (
        <button
          type="button"
          onClick={() => setMostrarPreview((v) => !v)}
          className="self-start rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {mostrarPreview ? "Editar" : "Prévia"}
        </button>
      )}
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={420}
        preview={preview}
        visibleDragbar={false}
        textareaProps={{
          disabled,
          "aria-label": "Conteúdo do prompt em Markdown",
        }}
      />
    </div>
  )
}
