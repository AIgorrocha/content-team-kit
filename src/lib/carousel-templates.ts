import type { SlideData, TemplateConfig } from "@/stores/carousel-store"
import { CLIENTS } from "@/lib/clients"
import type { CarouselTemplate } from "@/lib/clients/types"

export type { CarouselTemplate }

// Um template por cliente, lido do registro em src/lib/clients/{slug}.ts.
export const TEMPLATES: readonly CarouselTemplate[] = Object.values(CLIENTS).map(
  (c) => c.carouselTemplate
)

export function generateSlidesFromTemplate(template: CarouselTemplate, slideCount: number): SlideData[] {
  const client = CLIENTS[template.clientSlug]
  const generate = client?.generateFabricSlides ?? Object.values(CLIENTS)[0].generateFabricSlides
  return generate(slideCount)
}

export function templateConfigFromTemplate(t: CarouselTemplate): Omit<TemplateConfig, "showSafeZones"> {
  return {
    colors: t.colors,
    fonts: t.fonts,
    safeZone: t.safeZone,
    header: {
      show: true,
      name: t.header.name,
      handle: t.header.handle,
      avatarUrl: "",
      height: t.headerHeight,
    },
  }
}
