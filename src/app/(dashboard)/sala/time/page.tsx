import { redirect } from "next/navigation"

// Time virou o kanban de Trabalho (Batelada B3): a grade de 25 cartões deu lugar às
// 4 colunas por estado. O painel de detalhe (prompt, contexto, memória) continua o
// mesmo, aberto a partir do cartão do agente em /sala/trabalho.
export default function SalaTimePage() {
  redirect("/sala/trabalho")
}
