import { acme } from "./acme"
import type { ClientConfig } from "./types"

export type { ClientConfig, CarouselTemplate } from "./types"

// Registro de clientes do kit white-label. Adicione um cliente novo
// criando src/lib/clients/{slug}.ts (copie src/lib/clients/acme.ts
// como ponto de partida) e registrando aqui.
export const CLIENTS: Record<string, ClientConfig> = {
  [acme.slug]: acme,
}

export const DEFAULT_CLIENT_SLUG: string =
  process.env.NEXT_PUBLIC_DEFAULT_CLIENT_SLUG ?? Object.keys(CLIENTS)[0]

export function getClient(slug: string): ClientConfig | undefined {
  return CLIENTS[slug]
}

export function clientOptions(): { slug: string; label: string }[] {
  return Object.values(CLIENTS).map((c) => ({ slug: c.slug, label: c.label }))
}
