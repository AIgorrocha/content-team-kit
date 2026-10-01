import { redirect } from "next/navigation"

interface PecaAtalhoPageProps {
  params: { slug: string }
}

// Atalho /sala/pecas/{slug}: a tela de Peças é um quadro único cujo painel de
// detalhe abre por query string (?peca=), então o caminho direto só repassa pro
// deep link existente.
export default function PecaAtalhoPage({ params }: PecaAtalhoPageProps) {
  redirect(`/sala/pecas?peca=${encodeURIComponent(params.slug)}`)
}
