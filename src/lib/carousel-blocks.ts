import type { SlideData } from "@/stores/carousel-store"
import { CLIENTS } from "@/lib/clients"

// Registro por slug: gerador de blocos DOM por cliente. Cliente novo entra
// so adicionando o arquivo em src/lib/clients/, sem tocar em quem chama.
export const BLOCK_GENERATORS: Record<string, (count: number) => SlideData[]> = Object.fromEntries(
  Object.values(CLIENTS).map((c) => [c.slug, c.generateBlockSlides])
)
