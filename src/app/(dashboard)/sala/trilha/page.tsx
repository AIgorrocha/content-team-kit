import { redirect } from "next/navigation"

// Trilha virou a aba "Recortes" dentro do detalhe da peça youtube_longo (Batelada B4).
// A rota continua existindo só pra não quebrar link salvo; redireciona pro quadro de Peças.
export default function SalaTrilhaPage() {
  redirect("/sala/pecas")
}
