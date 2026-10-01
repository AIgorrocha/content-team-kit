import type { SalaData } from "@/lib/sala/types"
import { createMockSala } from "@/lib/sala/data/mock"
import { getLive } from "@/lib/sala/data/live"

// SALA_DATA permite escolher explicitamente; com banco configurado, o padrão é live.
function modoAtivo(): "live" | "mock" {
  return (process.env.SALA_DATA ?? (process.env.DATABASE_URL?.trim() ? "live" : "mock")) === "live" ? "live" : "mock"
}

export function estaEmModoLive(): boolean {
  return modoAtivo() === "live"
}

export function getSala(): SalaData {
  return modoAtivo() === "live" ? getLive() : createMockSala()
}
