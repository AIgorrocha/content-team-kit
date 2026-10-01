import type { SlideData, TemplateConfig } from "@/stores/carousel-store"

export interface CarouselTemplate {
  readonly id: string
  readonly name: string
  readonly clientSlug: string
  readonly headerHeight: number
  readonly safeZone: { top: number; bottom: number; left: number; right: number }
  readonly fonts: { headline: string; body: string }
  readonly colors: { primary: string; surface: string; text: string; textAlt: string }
  readonly header: { name: string; handle: string }
}

// Registro por cliente: tudo que hoje era literal espalhado pelo dashboard
// (slug, handle, cores de badge, geradores de slide) mora aqui, um arquivo
// por cliente em src/lib/clients/{slug}.ts. Cliente novo entra so criando o
// arquivo e registrando em src/lib/clients/index.ts.
export interface ClientConfig {
  readonly slug: string
  readonly label: string
  readonly handle: string
  readonly accountColors: { readonly badge: string; readonly dot: string }
  readonly calendarBadge?: { readonly label: string; readonly color: string }
  readonly carouselTemplate: CarouselTemplate
  readonly generateFabricSlides: (count: number) => SlideData[]
  readonly generateBlockSlides: (count: number) => SlideData[]
  readonly defaultCarouselConfig?: TemplateConfig
  // Cliente padrao do carousel builder ao abrir sem selecao. No maximo um cliente marca true.
  readonly isCarouselBuilderDefault?: boolean
  readonly threadsHandle?: string
}
