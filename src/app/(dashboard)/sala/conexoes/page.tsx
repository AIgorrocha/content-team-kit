import { redirect } from "next/navigation"

// Conexões virou parte do cartão de cada rede em /sala/redes (Batelada B5): validade e
// ação de conectar/renovar/testar ficam junto do resto da rede, num cartão só. A
// infraestrutura (Supabase, ai-memory, Telegram, MCPs) migrou pra /sala/ajustes.
export default function SalaConexoesPage() {
  redirect("/sala/redes")
}
