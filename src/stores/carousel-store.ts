import { create } from "zustand"
import { CLIENTS, DEFAULT_CLIENT_SLUG } from "@/lib/clients"

export interface ContentBlock {
  readonly id: string
  readonly type?: "text" | "image"
  readonly text: string
  readonly fontSize: number
  readonly fontWeight: string
  readonly fontFamily?: string
  readonly color?: string
  readonly lineHeight?: number
  readonly marginBottom?: number
  readonly letterSpacing?: number
  readonly imageUrl?: string
  readonly imageHeight?: number
  readonly borderRadius?: number
}

export interface SlideData {
  readonly id: string
  readonly backgroundColor: string
  readonly fabricJSON: object
  readonly thumbnailDataUrl: string | null
  readonly blocks?: readonly ContentBlock[]
}

export interface TemplateConfig {
  readonly colors: {
    readonly primary: string
    readonly surface: string
    readonly text: string
    readonly textAlt: string
  }
  readonly fonts: {
    readonly headline: string
    readonly body: string
  }
  readonly safeZone: {
    readonly top: number
    readonly bottom: number
    readonly left: number
    readonly right: number
  }
  readonly header: {
    readonly show: boolean
    readonly name: string
    readonly handle: string
    readonly avatarUrl: string
    readonly height: number
  }
  readonly showSafeZones: boolean
}

interface CarouselState {
  readonly slides: readonly SlideData[]
  readonly activeSlideIndex: number
  readonly projectName: string
  readonly clientSlug: string
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly templateConfig: TemplateConfig
  readonly selectedObjectId: string | null

  setClientSlug: (slug: string) => void
  setProjectName: (name: string) => void
  addSlide: (slide?: Partial<SlideData>) => void
  removeSlide: (index: number) => void
  duplicateSlide: (index: number) => void
  setActiveSlide: (index: number) => void
  updateSlideJSON: (index: number, json: object) => void
  updateSlideBackground: (index: number, color: string) => void
  updateSlideThumbnail: (index: number, dataUrl: string) => void
  setSlides: (slides: SlideData[]) => void
  updateTemplateConfig: (partial: Partial<TemplateConfig>) => void
  updateTemplateColors: (partial: Partial<TemplateConfig["colors"]>) => void
  updateTemplateFonts: (partial: Partial<TemplateConfig["fonts"]>) => void
  updateTemplateSafeZone: (partial: Partial<TemplateConfig["safeZone"]>) => void
  updateTemplateHeader: (partial: Partial<TemplateConfig["header"]>) => void
  toggleSafeZones: () => void
  setSelectedObjectId: (id: string | null) => void
}

// Cliente padrao do builder ao abrir sem selecao: quem marca isso e o
// ClientConfig com isCarouselBuilderDefault=true (ver src/lib/clients/{slug}.ts).
const BUILDER_DEFAULT_CLIENT =
  Object.values(CLIENTS).find((c) => c.isCarouselBuilderDefault) ?? CLIENTS[DEFAULT_CLIENT_SLUG]

const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = BUILDER_DEFAULT_CLIENT.defaultCarouselConfig ?? {
  colors: { primary: "#000000", surface: "#FFFFFF", text: "#000000", textAlt: "#FFFFFF" },
  fonts: { headline: "Inter", body: "Inter" },
  safeZone: { top: 80, bottom: 104, left: 49, right: 49 },
  header: { show: true, name: BUILDER_DEFAULT_CLIENT.label, handle: `@${BUILDER_DEFAULT_CLIENT.handle}`, avatarUrl: "", height: 80 },
  showSafeZones: false,
}

function makeId(): string {
  return crypto.randomUUID()
}

function createEmptySlide(bg?: string): SlideData {
  return {
    id: makeId(),
    backgroundColor: bg ?? "#FFFFFF",
    fabricJSON: { version: "6.0.0", objects: [] },
    thumbnailDataUrl: null,
  }
}

export const useCarouselStore = create<CarouselState>((set, get) => ({
  slides: [createEmptySlide()],
  activeSlideIndex: 0,
  projectName: "Novo Carrossel",
  clientSlug: BUILDER_DEFAULT_CLIENT.slug,
  canvasWidth: 1080,
  canvasHeight: 1350,
  templateConfig: DEFAULT_TEMPLATE_CONFIG,
  selectedObjectId: null,

  setClientSlug: (slug) => set({ clientSlug: slug }),
  setProjectName: (name) => set({ projectName: name }),

  addSlide: (partial) => {
    const { slides } = get()
    const bg = partial?.backgroundColor ?? (slides.length % 2 === 0 ? "#FFFFFF" : "#00BFFF")
    const newSlide = { ...createEmptySlide(bg), ...partial }
    set({ slides: [...slides, newSlide], activeSlideIndex: slides.length })
  },

  removeSlide: (index) => {
    const { slides, activeSlideIndex } = get()
    if (slides.length <= 1) return
    const next = slides.filter((_, i) => i !== index)
    const newActive = activeSlideIndex >= next.length ? next.length - 1 : activeSlideIndex
    set({ slides: next, activeSlideIndex: newActive })
  },

  duplicateSlide: (index) => {
    const { slides } = get()
    const source = slides[index]
    if (!source) return
    const dup: SlideData = { ...source, id: makeId(), thumbnailDataUrl: null }
    const next = [...slides.slice(0, index + 1), dup, ...slides.slice(index + 1)]
    set({ slides: next, activeSlideIndex: index + 1 })
  },

  setActiveSlide: (index) => set({ activeSlideIndex: index }),

  updateSlideJSON: (index, json) => {
    const { slides } = get()
    set({ slides: slides.map((s, i) => (i === index ? { ...s, fabricJSON: json } : s)) })
  },

  updateSlideBackground: (index, color) => {
    const { slides } = get()
    set({ slides: slides.map((s, i) => (i === index ? { ...s, backgroundColor: color } : s)) })
  },

  updateSlideThumbnail: (index, dataUrl) => {
    const { slides } = get()
    set({ slides: slides.map((s, i) => (i === index ? { ...s, thumbnailDataUrl: dataUrl } : s)) })
  },

  setSlides: (slides) => set({ slides, activeSlideIndex: 0 }),

  updateTemplateConfig: (partial) => {
    const { templateConfig } = get()
    set({ templateConfig: { ...templateConfig, ...partial } })
  },

  updateTemplateColors: (partial) => {
    const { templateConfig } = get()
    set({ templateConfig: { ...templateConfig, colors: { ...templateConfig.colors, ...partial } } })
  },

  updateTemplateFonts: (partial) => {
    const { templateConfig } = get()
    set({ templateConfig: { ...templateConfig, fonts: { ...templateConfig.fonts, ...partial } } })
  },

  updateTemplateSafeZone: (partial) => {
    const { templateConfig } = get()
    set({ templateConfig: { ...templateConfig, safeZone: { ...templateConfig.safeZone, ...partial } } })
  },

  updateTemplateHeader: (partial) => {
    const { templateConfig } = get()
    set({ templateConfig: { ...templateConfig, header: { ...templateConfig.header, ...partial } } })
  },

  toggleSafeZones: () => {
    const { templateConfig } = get()
    set({ templateConfig: { ...templateConfig, showSafeZones: !templateConfig.showSafeZones } })
  },

  setSelectedObjectId: (id) => set({ selectedObjectId: id }),
}))
