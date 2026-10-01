"use client"

export default function SalaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="space-y-4 rounded-md border border-border bg-surface p-6">
      <h1 className="text-xl font-semibold text-text-primary">Não foi possível carregar a Sala</h1>
      <p className="text-sm text-text-secondary">A conexão com os dados pode ter sido interrompida. Aguarde um momento e tente novamente.</p>
      <button type="button" onClick={reset} className="rounded-md border border-border bg-surface-hover px-4 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        Tentar novamente
      </button>
    </section>
  )
}
