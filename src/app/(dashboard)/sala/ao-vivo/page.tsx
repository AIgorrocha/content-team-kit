import { redirect } from "next/navigation"

// Ao vivo virou o kanban de Trabalho (Batelada B3): mapa de 6 caixas + feed de eventos
// deram lugar a um quadro só, por agente. Nada se perde: o feed de eventos continua vivo
// dentro do painel de detalhe do agente e via /sala/pecas (link do evento).
export default function SalaAoVivoPage() {
  redirect("/sala/trabalho")
}
