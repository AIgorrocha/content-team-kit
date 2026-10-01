import type { SlideData } from "@/stores/carousel-store"
import { block } from "@/lib/carousel-block-helpers"
import type { ClientConfig } from "./types"

// Cliente de exemplo do kit white-label. Copie este arquivo pra
// src/lib/clients/{seu-slug}.ts e ajuste cores, handle e geradores de slide
// pra colocar seu proprio cliente no ar.

function makeHeader() {
  return [
    { type: "circle", left: 56, top: 40, radius: 25, fill: "#333333", stroke: "#555555", strokeWidth: 1, selectable: true },
    { type: "text", text: "Acme", left: 118, top: 32, fontSize: 20, fontFamily: "Inter", fontWeight: "700", fill: "#FFFFFF", selectable: true },
    { type: "text", text: "@acme", left: 118, top: 58, fontSize: 15, fontFamily: "Inter", fontWeight: "400", fill: "#888888", selectable: true },
  ]
}

// Fabric.js canvas slides (usado pelo template do carousel builder)
function generateFabricSlides(count: number): SlideData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    backgroundColor: "#111111",
    fabricJSON: {
      version: "6.0.0",
      objects: [
        ...makeHeader(),
        {
          type: "text",
          text: i === 0 ? "Titulo principal\naqui." : "Texto do slide aqui.",
          left: 56,
          top: 280,
          fontSize: 36,
          fontFamily: "Inter",
          fontWeight: "700",
          fill: "#FFFFFF",
          width: 1080 - 112,
          lineHeight: 1.2,
          selectable: true,
        },
      ],
    },
    thumbnailDataUrl: null,
  }))
}

// DOM blocks (ct-carrossel-gen / HTML+Playwright)
function generateBlockSlides(count: number): SlideData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    backgroundColor: "#111111",
    fabricJSON: { version: "6.0.0", objects: [] },
    thumbnailDataUrl: null,
    blocks: [
      block(i === 0 ? "Titulo principal\naqui." : "Texto do slide aqui.", 36, "700", {
        color: "#FFFFFF",
        lineHeight: 1.25,
        marginBottom: 20,
      }),
    ],
  }))
}

export const acme: ClientConfig = {
  slug: "acme",
  label: "Acme",
  handle: "acme",
  accountColors: {
    badge: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    dot: "bg-slate-400",
  },
  carouselTemplate: {
    id: "acme-default",
    name: "Acme - Default",
    clientSlug: "acme",
    headerHeight: 120,
    safeZone: { top: 120, bottom: 80, left: 56, right: 56 },
    fonts: { headline: "Inter", body: "Inter" },
    colors: { primary: "#111111", surface: "#111111", text: "#FFFFFF", textAlt: "#4A90D9" },
    header: { name: "Acme", handle: "@acme" },
  },
  generateFabricSlides,
  generateBlockSlides,
  isCarouselBuilderDefault: true,
}
