import { redirect } from "next/navigation"

// Padrões virou parte do cartão de cada rede em /sala/redes (Batelada B5): capas
// aprovadas e aprendizados filtrados por rede, com a lista de regras editável no fim da
// página. Nada some, só reorganiza por rede em vez de por tipo de conteúdo.
export default function SalaPadroesPage() {
  redirect("/sala/redes")
}
